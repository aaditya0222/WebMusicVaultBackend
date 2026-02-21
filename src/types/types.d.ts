import { UserI } from "../models/user.model";

interface TokenPayload {
  _id: string;
}

declare global {
  namespace Express {
    interface Request {
      user: UserI;
    }
  }
}
