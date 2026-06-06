import { LoginForm } from "./components/LoginForm";
import { authenticate } from "../../../services/api/src/auth-controller";

export default function Login() {
  return LoginForm({ onSubmit: authenticate });
}
