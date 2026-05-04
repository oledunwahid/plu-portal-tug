declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      outlet: string;
      outletGroup: string;
    };
  }
  interface User {
    role: string;
    outlet: string;
    outletGroup: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    outlet: string;
    outletGroup: string;
  }
}
