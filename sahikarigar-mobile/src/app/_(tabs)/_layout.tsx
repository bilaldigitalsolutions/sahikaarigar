  // First launch after login â€” send the user to pick a role.
  // Check roleChosen BEFORE role to avoid a flash of wrong home screen.
  // This also handles the case where the tab layout re-renders with a stale `role`
  // right after the user picks a new role in RoleSelectionScreen.
  if (!roleChosen) return <Redirect href="/role-selection" />;