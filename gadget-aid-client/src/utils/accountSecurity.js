export const passwordHint =
  "Use 12–128 characters with uppercase, lowercase, a number and a symbol.";
export const passwordProblem = (password) =>
  typeof password !== "string" ||
  password.length < 12 ||
  password.length > 128 ||
  !/[A-Z]/.test(password) ||
  !/[a-z]/.test(password) ||
  !/[0-9]/.test(password) ||
  !/[^A-Za-z0-9\s]/.test(password)
    ? passwordHint
    : "";
const failure = (code) =>
  Object.assign(new Error("Account security operation could not complete."), {
    code,
  });
export const createSecurityActions = (adapter) => {
  const current = () => {
    const user = adapter.getUser();
    if (!user) throw failure("auth/user-token-expired");
    return user;
  };
  const unchanged = (user) => {
    if (adapter.getUser()?.uid !== user.uid)
      throw failure("auth/user-token-expired");
  };
  const reauthenticate = async (user, currentPassword) => {
    const password = user.providerData.some((p) => p.providerId === "password");
    if (password) {
      if (!currentPassword) throw failure("security/current-password-required");
      await adapter.reauthenticatePassword(user, currentPassword);
    } else if (user.providerData.some((p) => p.providerId === "google.com"))
      await adapter.reauthenticateGoogle(user);
    else throw failure("security/unsupported-provider");
    unchanged(user);
    return password;
  };
  return {
    async changePassword({ currentPassword, newPassword, confirmation }) {
      const user = current();
      if (passwordProblem(newPassword)) throw failure("security/weak-password");
      if (newPassword !== confirmation)
        throw failure("security/password-mismatch");
      if (currentPassword === newPassword)
        throw failure("security/password-reused");
      if (!(await adapter.validatePassword(newPassword)))
        throw failure("security/weak-password");
      unchanged(user);
      const hasPassword = await reauthenticate(user, currentPassword);
      if (hasPassword) await adapter.updatePassword(user, newPassword);
      else {
        if (!user.emailVerified)
          throw failure("security/verified-email-required");
        await adapter.linkPassword(user, newPassword);
      }
      unchanged(user);
      try {
        await adapter.signOut();
        return { changed: true, signedOut: true };
      } catch {
        return { changed: true, signedOut: false };
      }
    },
    async linkGoogle({ currentPassword }) {
      const user = current();
      if (user.providerData.some((p) => p.providerId === "google.com")) return;
      await reauthenticate(user, currentPassword);
      await adapter.linkGoogle(user);
      unchanged(user);
      await adapter.reload(user);
    },
  };
};
