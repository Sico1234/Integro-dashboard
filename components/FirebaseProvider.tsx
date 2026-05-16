'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  signInAnonymously,
  signOut,
} from 'firebase/auth';

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  where,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { differenceInDays } from 'date-fns';
import { calculateAgeing } from '@/lib/utils';
import {
  sendOverdueEmail,
  sendHighPriorityEmail,
} from '@/lib/email-utils';

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
  exportableCases: any[];
  agents: any[];
  users: any[];
  search: string;
  setSearch: (s: string) => void;
  columnFilters: Record<string, string>;
  setColumnFilters: React.Dispatch<
    React.SetStateAction<
      Record<string, string>
    >
  >;
  filteredCases: any[];
  login: (
    username: string,
    password: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (
    newPassword: string
  ) => Promise<void>;
  getNextCaseCounter: (
    increment?: number
  ) => Promise<number>;
  createUser: (
    userData: any
  ) => Promise<void>;
  deleteUser: (
    userId: string
  ) => Promise<void>;
}

const FirebaseContext =
  createContext<
    FirebaseContextType | undefined
  >(undefined);

export function FirebaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [cases, setCases] =
    useState<any[]>([]);

  const [agents, setAgents] =
    useState<any[]>([]);

  const [users, setUsers] =
    useState<any[]>([]);

  const [search, setSearch] =
    useState('');

  const [columnFilters,
    setColumnFilters] =
    useState<
      Record<string, string>
    >({});

  const deferredSearch =
    React.useDeferredValue(search);

  const filteredCases =
    useMemo(() => {
      return cases.filter(c => {
        const globalMatch =
          !deferredSearch ||
          Object.values(c)
            .join(' ')
            .toLowerCase()
            .includes(
              deferredSearch.toLowerCase()
            );

        if (!globalMatch)
          return false;

        return Object.entries(
          columnFilters
        ).every(
          ([field, value]) => {
            if (!value)
              return true;

            const fieldValue =
              String(
                c[field] || ''
              ).toLowerCase();

            return fieldValue.includes(
              value.toLowerCase()
            );
          }
        );
      });
    }, [
      cases,
      deferredSearch,
      columnFilters,
    ]);

  const exportableCases =
    useMemo(() => {
      if (!user) return [];

      if (
        user.role === 'admin'
      ) {
        return filteredCases;
      }

      const currentAgent =
        agents.find(
          a =>
            a.email
              ?.toLowerCase()
              .trim() ===
            user.email
              ?.toLowerCase()
              .trim()
        );

      if (!currentAgent)
        return [];

      return filteredCases.filter(
        c =>
          String(
            c.assignedTo || ''
          )
            .toLowerCase()
            .trim() ===
          currentAgent.name
            .toLowerCase()
            .trim()
      );
    }, [
      filteredCases,
      user,
      agents,
    ]);

  useEffect(() => {
    const initAuth =
      async () => {
        try {
          try {
            await signInAnonymously(
              auth
            );
          } catch {}

          const savedUser =
            localStorage.getItem(
              'integro_user'
            );

          if (savedUser) {
            const parsed =
              JSON.parse(
                savedUser
              );

            const q = query(
              collection(
                db,
                'users'
              ),
              where(
                'username',
                '==',
                parsed.username
              )
            );

            const snapshot =
              await getDocs(q);

            if (
              !snapshot.empty
            ) {
              const userData =
                snapshot.docs[0].data();

              const updatedAt =
                userData.passwordUpdatedAt?.toDate() ||
                new Date();

              const daysSinceUpdate =
                differenceInDays(
                  new Date(),
                  updatedAt
                );

              setUser({
                username:
                  userData.username,
                role:
                  userData.role ||
                  'admin',
                email:
                  userData.email,
                passwordUpdatedAt:
                  userData.passwordUpdatedAt,
                isExpired:
                  daysSinceUpdate >=
                  90,
              });
            }
          }
        } finally {
          setLoading(false);
        }
      };

    initAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setAgents([]);
      setUsers([]);
      return;
    }

    const agentsQuery =
      query(
        collection(
          db,
          'agents'
        ),
        orderBy(
          'name',
          'asc'
        )
      );

    const unsubscribeAgents =
      onSnapshot(
        agentsQuery,
        snapshot => {
          setAgents(
            snapshot.docs.map(
              doc => ({
                id: doc.id,
                ...doc.data(),
              })
            )
          );
        }
      );

    let unsubscribeUsers =
      () => {};

    if (
      user.role === 'admin'
    ) {
      const usersQuery =
        query(
          collection(
            db,
            'users'
          ),
          orderBy(
            'username',
            'asc'
          )
        );

      unsubscribeUsers =
        onSnapshot(
          usersQuery,
          snapshot => {
            setUsers(
              snapshot.docs.map(
                doc => ({
                  id: doc.id,
                  ...doc.data(),
                })
              )
            );
          }
        );
    }

    return () => {
      unsubscribeAgents();
      unsubscribeUsers();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCases([]);
      return;
    }

    let casesQuery;

    if (
      user.role ===
        'agent' &&
      user.email
    ) {
      const agent =
        agents.find(
          a =>
            a.email ===
            user.email
        );

      const agentName =
        agent
          ? agent.name
          : '';

      casesQuery = query(
        collection(
          db,
          'cases'
        ),
        where(
          'assignedTo',
          '==',
          agentName
        ),
        orderBy(
          'receivedDate',
          'desc'
        )
      );
    } else {
      casesQuery = query(
        collection(
          db,
          'cases'
        ),
        orderBy(
          'receivedDate',
          'desc'
        )
      );
    }

    const unsubscribeCases =
      onSnapshot(
        casesQuery,
        snapshot => {
          setCases(
            snapshot.docs.map(
              doc => ({
                id: doc.id,
                ...doc.data(),
              })
            )
          );
        }
      );

    return () =>
      unsubscribeCases();
  }, [user, agents]);

  const login = async (
    username: string,
    password: string
  ) => {
    try {
      const q = query(
        collection(
          db,
          'users'
        ),
        where(
          'username',
          '==',
          username
        ),
        where(
          'password',
          '==',
          password
        )
      );

      const snapshot =
        await getDocs(q);

      if (
        !snapshot.empty
      ) {
        const userData =
          snapshot.docs[0].data();

        setUser({
          username:
            userData.username,
          role:
            userData.role,
          email:
            userData.email,
          passwordUpdatedAt:
            userData.passwordUpdatedAt,
          isExpired:
            false,
        });

        localStorage.setItem(
          'integro_user',
          JSON.stringify({
            username:
              userData.username,
          })
        );

        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const logout =
    async () => {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem(
        'integro_user'
      );
    };

  const changePassword =
    async (
      newPassword: string
    ) => {};

  const createUser =
    async (
      userData: any
    ) => {};

  const deleteUser =
    async (
      userId: string
    ) => {};

  const getNextCaseCounter =
    async (
      increment = 1
    ) => {
      return 1;
    };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        loading,
        cases,
        exportableCases,
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
        deleteUser,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context =
    useContext(
      FirebaseContext
    );

  if (!context) {
    throw new Error(
      'useFirebase must be used within FirebaseProvider'
    );
  }

  return context;
}