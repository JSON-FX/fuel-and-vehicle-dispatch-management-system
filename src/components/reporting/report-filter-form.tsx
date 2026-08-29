import { Search } from 'lucide-react';
import Link from 'next/link';

import type {
  ReportPageType,
  ReportReferenceDto,
  ReportType,
} from '@/application/reporting/dto/report-dtos';
import { getReportDefinition } from '@/application/reporting/services/report-catalogue';
import type { ReportPageValues } from '@/lib/reporting/page-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export function ReportFilterForm({
  values,
  offices,
  reportTypes,
}: {
  readonly values: ReportPageValues;
  readonly offices: readonly ReportReferenceDto[];
  readonly reportTypes: readonly ReportType[];
}) {
  const showStatus = values.report === 'FUEL_ISSUANCE' || values.report === 'DISPATCH';
  const custom = values.periodType === 'CUSTOM';

  return (
    <Card aria-labelledby="report-filter-heading">
      <CardContent className="pt-6">
        <form action="/reports" method="get" className="space-y-4">
          <h2 id="report-filter-heading" className="font-heading text-lg font-semibold">
            Filter reports
          </h2>
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Field id="report-type" label="Report">
              <NativeSelect id="report-type" name="report" defaultValue={values.report}>
                <option value="OVERVIEW">Overview</option>
                {reportTypes.map((reportType) => (
                  <option key={reportType} value={reportType}>
                    {getReportDefinition(reportType).label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="report-office" label="Office">
              <NativeSelect
                id="report-office"
                name="requestingOfficePublicId"
                defaultValue={values.requestingOfficePublicId}
              >
                <option value="">All offices</option>
                {offices.map((office) => (
                  <option key={office.publicId} value={office.publicId}>
                    {office.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="report-period" label="Period">
              <NativeSelect id="report-period" name="periodType" defaultValue={values.periodType}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
                <option value="CUSTOM">Custom</option>
              </NativeSelect>
            </Field>
            {custom ? (
              <>
                <Field id="report-start-date" label="Start date">
                  <Input
                    id="report-start-date"
                    name="startDate"
                    type="date"
                    defaultValue={values.startDate}
                    required
                  />
                </Field>
                <Field id="report-end-date" label="End date">
                  <Input
                    id="report-end-date"
                    name="endDate"
                    type="date"
                    defaultValue={values.endDate}
                    required
                  />
                </Field>
              </>
            ) : (
              <Field id="report-reference-date" label="Reference date">
                <Input
                  id="report-reference-date"
                  name="referenceDate"
                  type="date"
                  defaultValue={values.referenceDate}
                  required
                />
              </Field>
            )}
            {showStatus ? (
              <Field id="report-status" label="Status">
                <NativeSelect id="report-status" name="status" defaultValue={values.status}>
                  <option value="">All included statuses</option>
                  {statusOptions(values.report).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
          </div>
          <input type="hidden" name="pageSize" value={values.pageSize} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit">
              <Search aria-hidden="true" /> Apply filters
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/reports">Clear filters</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function statusOptions(reportType: ReportPageType): readonly (readonly [string, string])[] {
  return reportType === 'FUEL_ISSUANCE'
    ? [
        ['POSTED', 'Posted'],
        ['VOIDED', 'Voided'],
      ]
    : [
        ['DRAFT', 'Draft'],
        ['DISPATCHED', 'Dispatched'],
        ['COMPLETED', 'Completed'],
        ['CANCELLED', 'Cancelled'],
      ];
}
