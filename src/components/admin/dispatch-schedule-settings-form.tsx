'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type {
  DispatchScheduleSettingsDto,
  UpdateDispatchScheduleSettingsCommand,
} from '@/application/dispatch/dto/dispatch-dtos';
import { FormStatus } from '@/components/forms/form-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { readDispatchApiResponse } from '@/lib/dispatch/dispatch-form-response';

export function DispatchScheduleSettingsForm({
  csrfToken,
  settings,
}: {
  readonly csrfToken: string;
  readonly settings: DispatchScheduleSettingsDto;
}) {
  const router = useRouter();
  const [policy, setPolicy] = useState(settings.policy);
  const [blockConfirmed, setBlockConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (policy === 'BLOCK' && !blockConfirmed) {
      setMessage('Confirm that conflicting dispatches should be blocked before saving.');
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/dispatch-schedule-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ policy } satisfies UpdateDispatchScheduleSettingsCommand),
      });
      await readDispatchApiResponse<DispatchScheduleSettingsDto>(response);
      setMessage('Global dispatch schedule policy updated.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The schedule policy could not be updated.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global schedule policy</CardTitle>
        <CardDescription>
          This policy applies to every dispatch office and is checked again during each mutation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <FormStatus message={message} />
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Conflict behavior</legend>
            <PolicyOption
              checked={policy === 'WARN_AND_ACK'}
              value="WARN_AND_ACK"
              title="Warn and require acknowledgment"
              description="Authorized dispatch officers may proceed after reviewing the latest conflicts and recording a reason."
              onChange={() => {
                setPolicy('WARN_AND_ACK');
                setBlockConfirmed(false);
              }}
            />
            <PolicyOption
              checked={policy === 'BLOCK'}
              value="BLOCK"
              title="Block conflicting dispatches"
              description="No acknowledgment can bypass a same-day driver or vehicle reservation."
              onChange={() => setPolicy('BLOCK')}
            />
          </fieldset>
          {policy === 'BLOCK' ? (
            <label className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
              <input
                className="mt-1 size-4"
                type="checkbox"
                checked={blockConfirmed}
                onChange={(event) => setBlockConfirmed(event.target.checked)}
              />
              <span>I understand that all detected same-day conflicts will be blocked.</span>
            </label>
          ) : null}
          <Button type="submit" disabled={pending || policy === settings.policy}>
            <Save aria-hidden="true" /> {pending ? 'Saving…' : 'Save policy'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PolicyOption({
  checked,
  value,
  title,
  description,
  onChange,
}: {
  readonly checked: boolean;
  readonly value: 'BLOCK' | 'WARN_AND_ACK';
  readonly title: string;
  readonly description: string;
  readonly onChange: () => void;
}) {
  return (
    <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-md border p-4 has-[:checked]:border-ring has-[:checked]:ring-2 has-[:checked]:ring-ring/30">
      <input
        className="mt-1 size-4"
        type="radio"
        name="policy"
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
