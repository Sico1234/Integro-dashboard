'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { signInAnonymously, User, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, getDocs, where, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, Timestamp, runTransaction } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { differenceInDays } from 'date-fns';
import { calculateAgeing } from '@/lib/utils';
import { sendOverdueEmail, sendHighPriorityEmail } from '@/lib/email-utils';

interface AuthUser {
  username: string;
  role: 'admin' | 'agent';
  email?: string;
  passwordUpdatedAt: Timestamp;
  isExpired: boolean;
}

interface FirebaseContextType {
  user: AuthUser | null;
  loading: boolean;
  cases: any[];
  agents: any[];
  users: any[];
  search: string;
  setSearch: (s: string) => void;
  columnFilters: Record<string, string>;
  setColumnFilters: (f: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  filteredCases: any[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  getNextCaseCounter: (increment?: number) => Promise<number>;
  createUser: (userData: any) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const deferredSearch = React.useDeferredValue(search);

  const filteredCases = React.useMemo(() => {
    return cases.filter(c => {
      // Global search
      const globalMatch = !deferredSearch || 
        (c.uniqueId || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.agmtNo || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.borrowerName || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.company || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.priority || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.fro || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.to || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.pool || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (c.dsSbRemarks || '').toLowerCase().includes(deferredSearch.toLowerCase());

      if (!globalMatch) return false;

      // Column filters
      return Object.entries(columnFilters).every(([field, value]) => {
        if (!value) return true;
        
        if (field === 'receivedDate' || field === 'noticeDate' || field === 'dispatchedDate') {
          if (!c[field]) return false;
          const dateObj = c[field].toDate ? c[field].toDate() : new Date(c[field]);
          const formattedDate = dateObj.toLocaleDateString('en-GB').replace(/\//g, '-');
          return formattedDate.includes(value);
        }

        if (field === 'ageing') {
          const ageing = calculateAgeing(c.receivedDate);
          if (ageing === null) return false;
          
          if (value === 'slate') return c.dispatchStatus === 'Closed';
          if (c.dispatchStatus === 'Closed') return false; // If searching for other colors, discard Closed

          if (value === 'purple') return c.dispatchStatus === 'Hold';
          if (c.dispatchStatus === 'Hold') return false; // If searching for other colors, discard Hold
          
          if (value === 'green') return ageing <= 3;
          if (value === 'yellow') return ageing >= 4 && ageing <= 7;
          if (value === 'black') return ageing > 7 && c.dispatchStatus === 'Dispatched';
          if (value === 'red') return ageing > 7 && c.dispatchStatus !== 'Dispatched';
          return true;
        }

        // Special handling for Pending status to include null/empty
        if (field === 'dispatchStatus' && value.toLowerCase() === 'pending') {
          return !c.dispatchStatus || c.dispatchStatus.toLowerCase() === 'pending' || c.dispatchStatus === '';
        }

        // Special handling for Assigned To "unassigned" search
        if (field === 'assignedTo' && value.toLowerCase() === 'unassigned') {
          return !c.assignedTo || String(c.assignedTo).toLowerCase() === 'unassigned' || c.assignedTo === '';
        }

        const fieldValue = String(c[field] || '').toLowerCase();
        return fieldValue.includes(value.toLowerCase());
      });
    });
  }, [cases, deferredSearch, columnFilters]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to sign in anonymously if enabled, but don't block if restricted
        try {
          await signInAnonymously(auth);
        } catch (e: any) {
          const ignoredCodes = [
            'auth/admin-restricted-operation', 
            'auth/operation-not-allowed',
            'auth/network-request-failed'
          ];
          if (!ignoredCodes.includes(e.code)) {
            console.error("Anonymous auth error:", e);
          }
        }

        const savedUser = localStorage.getItem('integro_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          // Re-verify with Firestore
          const q = query(collection(db, 'users'), where('username', '==', parsed.username));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            const updatedAt = userData.passwordUpdatedAt?.toDate() || new Date();
            const daysSinceUpdate = differenceInDays(new Date(), updatedAt);
            
            setUser({
              username: userData.username,
              role: userData.role || 'admin',
              email: userData.email,
              passwordUpdatedAt: userData.passwordUpdatedAt,
              isExpired: daysSinceUpdate >= 90
            });
          } else {
            localStorage.removeItem('integro_user');
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setTimeout(() => {
        setAgents([]);
        setUsers([]);
      }, 0);
      return;
    }

    const agentsQuery = query(collection(db, 'agents'), orderBy('name', 'asc'));
    const unsubscribeAgents = onSnapshot(agentsQuery, (snapshot) => {
      const agentsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAgents(agentsData);
    }, (error) => {
      console.error("Firestore Agents Error: ", error);
    });

    // Only admins can see all users
    let unsubscribeUsers = () => {};
    if (user.role === 'admin') {
      const usersQuery = query(collection(db, 'users'), orderBy('username', 'asc'));
      unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      });
    }

    return () => {
      unsubscribeAgents();
      unsubscribeUsers();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTimeout(() => {
        setCases([]);
      }, 0);
      return;
    }

    // Filter cases if user is an agent
    let casesQuery;
    if (user.role === 'agent' && user.email) {
      // Find the agent name associated with this email
      const agent = agents.find(a => a.email === user.email);
      const agentName = agent ? agent.name : '';
      
      casesQuery = query(
        collection(db, 'cases'), 
        where('assignedTo', '==', agentName),
        orderBy('receivedDate', 'desc')
      );
    } else {
      casesQuery = query(collection(db, 'cases'), orderBy('receivedDate', 'desc'));
    }

    const unsubscribeCases = onSnapshot(casesQuery, (snapshot) => {
      const casesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCases(casesData);
    }, (error) => {
      console.error("Firestore Cases Error: ", error);
    });

    return () => {
      unsubscribeCases();
    };
  }, [user, agents]);

  const casesRef = useRef(cases);
  const agentsRef = useRef(agents);

  useEffect(() => {
    casesRef.current = cases;
    agentsRef.current = agents;
  }, [cases, agents]);

  // Dedicated effect for automated overdue checks (Admin only)
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const performOverdueCheck = async () => {
      const currentCases = casesRef.current;
      const currentAgents = agentsRef.current;
      
      if (currentCases.length === 0 || currentAgents.length === 0) return;
      
      for (const c of currentCases) {
        const ageing = calculateAgeing(c.receivedDate);
        const isNotDispatched = (!c.dispatchStatus || c.dispatchStatus === 'Pending' || c.dispatchStatus === '');
        
        if (!isNotDispatched || !c.assignedTo || ageing === null) continue;

        // 1. Check for standard 7-day overdue
        if (ageing > 7 && !c.overdueEmailSent) {
          const agent = currentAgents.find(a => a.name.toLowerCase().trim() === String(c.assignedTo).toLowerCase().trim());
          if (agent?.email) {
            try {
              await sendOverdueEmail(agent.email, agent.name, c);
              await updateDoc(doc(db, 'cases', c.id), { 
                overdueEmailSent: true, 
                overdueEmailSentAt: serverTimestamp()
              });
            } catch (err) {
              console.error("Failed to send overdue email:", err);
            }
          }
        }

        // 2. Check for 10-day escalation to HIGH PRIORITY
        if (ageing > 10 && !c.highPriorityEmailSent) {
          const agent = currentAgents.find(a => a.name.toLowerCase().trim() === String(c.assignedTo).toLowerCase().trim());
          if (agent?.email) {
            try {
              // Send high priority warning email
              await sendHighPriorityEmail(agent.email, agent.name, { ...c, ageing });
              
              // Automatically move to High Priority in Firestore
              await updateDoc(doc(db, 'cases', c.id), { 
                priority: 'High',
                highPriorityEmailSent: true, 
                highPriorityEmailSentAt: serverTimestamp()
              });
            } catch (err) {
              console.error("Failed to send high priority escalation email:", err);
            }
          }
        }
      }
    };

    // Run once initially and then every 30 minutes
    const initialCheck = setTimeout(performOverdueCheck, 5000);
    const interval = setInterval(performOverdueCheck, 30 * 60 * 1000);
    
    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [user, cases.length, agents.length]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Bootstrap check: if no users exist, create the default one
      const usersSnap = await getDocs(collection(db, 'users'));
      if (usersSnap.empty) {
        await setDoc(doc(db, 'users', 'integro'), {
          username: 'integro',
          password: 'Admin@2026',
          role: 'admin',
          passwordUpdatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      const q = query(collection(db, 'users'), where('username', '==', username), where('password', '==', password));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        const updatedAt = userData.passwordUpdatedAt?.toDate() || new Date();
        const daysSinceUpdate = differenceInDays(new Date(), updatedAt);
        
        const authUser: AuthUser = {
          username: userData.username,
          role: userData.role || 'admin',
          email: userData.email,
          passwordUpdatedAt: userData.passwordUpdatedAt,
          isExpired: daysSinceUpdate >= 90
        };
        
        setUser(authUser);
        localStorage.setItem('integro_user', JSON.stringify({ username: userData.username }));
        
        // Only clear filters if an agent is logging in
        if (authUser.role === 'agent') {
          setSearch("");
          setColumnFilters({});
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const createUser = async (userData: any) => {
    try {
      const userRef = doc(collection(db, 'users'));
      await setDoc(userRef, {
        ...userData,
        passwordUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Create user error:", error);
      throw error;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
    } catch (error) {
      console.error("Delete user error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('integro_user');
      // We don't clear filters here so Admin filters stay preserved 
      // unless an agent logs in or the page is refreshed.
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const changePassword = async (newPassword: string) => {
    if (!user) return;
    try {
      const q = query(collection(db, 'users'), where('username', '==', user.username));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0].ref;
        await updateDoc(userDoc, {
          password: newPassword,
          passwordUpdatedAt: serverTimestamp()
        });
        
        // Update local state
        setUser({
          ...user,
          isExpired: false,
          passwordUpdatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error("Change password error:", error);
      throw error;
    }
  };

  const getNextCaseCounter = async (increment: number = 1): Promise<number> => {
    const counterRef = doc(db, 'metadata', 'counters');
    try {
      const startCounter = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { cases: increment });
          return 1;
        }
        const currentCounter = counterDoc.data().cases || 0;
        const newCounter = currentCounter + increment;
        transaction.update(counterRef, { cases: newCounter });
        return currentCounter + 1;
      });
      return startCounter;
    } catch (error) {
      console.error("Error getting next counter:", error);
      const snapshot = await getDocs(collection(db, 'cases'));
      return snapshot.size + 1;
    }
  };

  return (
    <FirebaseContext.Provider value={{ 
      user, 
      loading, 
      cases, 
      agents, 
      users,
      search,
      setSearch,
      columnFilters,
      setColumnFilters,
      filteredCases,
      login, 
      logout, 
      changePassword, 
      getNextCaseCounter,
      createUser,
      deleteUser
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
