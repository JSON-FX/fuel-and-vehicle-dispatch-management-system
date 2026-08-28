export function FormFieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message?: string | undefined;
}) {
  return message === undefined ? null : (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
