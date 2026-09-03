export interface StepperProps {
  id: string
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
}

export function Stepper({ id, value, min = 0, max, onChange }: StepperProps) {
  return (
    <div className="step">
      <button type="button" data-testid={`${id}-minus`} disabled={value <= min} onClick={() => onChange(value - 1)}>-</button>
      <b data-testid={id}>{value}</b>
      <button type="button" data-testid={`${id}-plus`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}
