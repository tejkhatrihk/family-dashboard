import { useCallback, useEffect, useMemo, useState } from "react";
import { useFirebaseAuth } from "../../../shared/api/firebaseAuthContext";
import {
  createHousehold as createHouseholdRecord,
  createHouseholdInvite,
  createManagedHouseholdMember,
  joinHousehold as joinHouseholdWithCode,
  subscribeToHousehold,
  subscribeToHouseholdMembers,
  subscribeToUserProfile,
  updateMemberProfile,
} from "../services/householdService";
import { HouseholdContext } from "./householdContext";

function HouseholdSession({ children, user, isConfigured }) {
  const [householdId, setHouseholdId] = useState(null);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !isConfigured) {
      return undefined;
    }

    return subscribeToUserProfile(
      user.uid,
      (snapshot) => {
        const nextHouseholdId = snapshot.data()?.currentHouseholdId || null;
        setHouseholdId(nextHouseholdId);
        if (!nextHouseholdId) {
          setHousehold(null);
          setMembers([]);
          setLoading(false);
        }
      },
      (profileError) => {
        setError(profileError);
        setLoading(false);
      },
    );
  }, [isConfigured, user]);

  useEffect(() => {
    if (!householdId) {
      return undefined;
    }

    const handleError = (subscriptionError) => setError(subscriptionError);
    const unsubscribeHousehold = subscribeToHousehold(
      householdId,
      (snapshot) => {
        setHousehold(
          snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
        );
        if (!snapshot.exists()) setLoading(false);
      },
      handleError,
    );
    const unsubscribeMembers = subscribeToHouseholdMembers(
      householdId,
      (snapshot) => {
        setMembers(
          snapshot.docs.map((member) => ({ id: member.id, ...member.data() })),
        );
        setLoading(false);
      },
      handleError,
    );
    return () => {
      unsubscribeHousehold();
      unsubscribeMembers();
    };
  }, [householdId]);

  const createHousehold = useCallback(
    async (name) => {
      setError(null);
      setLoading(true);
      try {
        return await createHouseholdRecord(name, user);
      } catch (createError) {
        setLoading(false);
        throw createError;
      }
    },
    [user],
  );

  const joinHousehold = useCallback(
    async (code) => {
      setError(null);
      setLoading(true);
      try {
        return await joinHouseholdWithCode(code, user);
      } catch (joinError) {
        setLoading(false);
        throw joinError;
      }
    },
    [user],
  );

  const inviteMember = useCallback(
    async (email) => {
      setError(null);
      return createHouseholdInvite(householdId, email, user);
    },
    [householdId, user],
  );

  const addManagedMember = useCallback(
    async (displayName) => {
      setError(null);
      return createManagedHouseholdMember(householdId, displayName, user);
    },
    [householdId, user],
  );

  const updateMember = useCallback(
    (uid, changes) => updateMemberProfile(householdId, uid, changes),
    [householdId],
  );

  const value = useMemo(
    () => ({
      household,
      householdId,
      members,
      loading,
      error,
      createHousehold,
      joinHousehold,
      inviteMember,
      addManagedMember,
      updateMember,
      isOwner: household?.ownerId === user?.uid,
    }),
    [
      createHousehold,
      addManagedMember,
      error,
      household,
      householdId,
      inviteMember,
      joinHousehold,
      loading,
      members,
      updateMember,
      user?.uid,
    ],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export default function HouseholdProvider({ children }) {
  const { user, isConfigured } = useFirebaseAuth();
  return (
    <HouseholdSession
      key={user?.uid || "signed-out"}
      user={user}
      isConfigured={isConfigured}
    >
      {children}
    </HouseholdSession>
  );
}
