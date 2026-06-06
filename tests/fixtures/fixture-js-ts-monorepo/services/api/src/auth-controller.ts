import { normalizeUserName } from "../../../packages/shared/src/auth";

export function authenticate(userName = "fixture") {
  return normalizeUserName(userName).length > 0;
}

export class AuthController {
  public login(userName: string) {
    return authenticate(userName);
  }
}
