import { Submit } from "@/components/submit";
type Values = {
  title?: string;
  work_area?: string;
  inspected_at?: string;
  inspector_name?: string;
  description?: string;
  observations?: string;
};
export function InspectionFields({ values = {} }: { values?: Values }) {
  return (
    <>
      <label>
        Inspection title
        <input
          name="title"
          required
          minLength={2}
          maxLength={160}
          defaultValue={values.title}
        />
      </label>
      <label>
        Work area / location
        <input
          name="work_area"
          required
          minLength={2}
          maxLength={200}
          defaultValue={values.work_area}
        />
      </label>
      <label>
        Inspection date and time (UTC)
        <input
          type="datetime-local"
          name="inspected_at"
          required
          min="2000-01-01T00:00"
          max="2099-12-31T23:59"
          defaultValue={
            values.inspected_at
              ? new Date(values.inspected_at).toISOString().slice(0, 16)
              : undefined
          }
        />
      </label>
      <label>
        Inspector name
        <input
          name="inspector_name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={values.inspector_name}
        />
      </label>
      <p className="footnote">
        Enter the inspector’s display name. The signed-in author is recorded
        separately and cannot be changed.
      </p>
      <label>
        Description
        <textarea
          name="description"
          rows={4}
          maxLength={8000}
          defaultValue={values.description}
        />
      </label>
      <label>
        Observations
        <textarea
          name="observations"
          rows={6}
          maxLength={8000}
          defaultValue={values.observations}
        />
      </label>
      <Submit>Save draft</Submit>
    </>
  );
}
