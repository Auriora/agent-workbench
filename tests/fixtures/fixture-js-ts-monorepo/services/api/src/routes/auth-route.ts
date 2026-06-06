import { AuthController } from "../auth-controller";

export const authRoute = {
  method: "POST",
  path: "/login",
  handler: new AuthController().login
};
