export default function CustomerNameFields({
  firstName, surname, onChange, disabled = false,
}: {
  firstName: string
  surname: string
  onChange: (firstName: string, surname: string) => void
  disabled?: boolean
}) {
  return <>
    <label>
      First Name
      <input autoComplete="given-name" value={firstName} disabled={disabled}
        onChange={(event) => onChange(event.target.value, surname)} />
    </label>
    <label>
      Surname
      <input autoComplete="family-name" value={surname} disabled={disabled}
        onChange={(event) => onChange(firstName, event.target.value)} />
    </label>
  </>
}
