export type LoginFormProps = {
  onSubmit: () => boolean;
};

export function LoginForm(props: LoginFormProps) {
  return props.onSubmit() ? "ok" : "blocked";
}
