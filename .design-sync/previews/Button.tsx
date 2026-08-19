import { Button } from "flexpass-ui";

export function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button variant="default">Save changes</Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="outline">Duplicate event</Button>
      <Button variant="ghost">Skip for now</Button>
      <Button variant="destructive">Delete event</Button>
      <Button variant="link">View details</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button disabled>Withdraw funds</Button>
      <Button variant="outline" disabled>
        Unavailable
      </Button>
    </div>
  );
}
