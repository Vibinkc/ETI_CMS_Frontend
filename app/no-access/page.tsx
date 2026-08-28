"use client";

import { useAuth } from "@/components/AuthProvider";

/**
 * Where an account lands when its role grants nothing it can open. Better than
 * a 404: it names the problem and says who can fix it.
 */
export default function NoAccess() {
  const { user, roleName } = useAuth();
  return (
    <>
      <div className="topbar">
        <h1>Nothing to show</h1>
      </div>
      <div className="content">
        <div className="empty">
          <p>
            You are signed in as <strong>{user?.username}</strong>
            {roleName ? <> with the <strong>{roleName}</strong> role</> : <> with no role assigned</>}.
          </p>
          <p>
            That role does not currently allow access to any section of the CMS.
            Ask an administrator to give it the permissions you need.
          </p>
        </div>
      </div>
    </>
  );
}
