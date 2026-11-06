declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        roleId: string;
        canCreateGroup: boolean;
        canSendMessage: boolean;
      };
    }
  }
}

export {};
