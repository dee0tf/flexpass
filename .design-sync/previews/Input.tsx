import { Input } from "flexpass-ui";

export function Default() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Account Number</label>
      <Input placeholder="0123456789" maxLength={10} />
    </div>
  );
}

export function Filled() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Email</label>
      <Input defaultValue="derrick@flexpasshq.com" type="email" />
    </div>
  );
}

export function ReadOnlyVerified() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Account Name</label>
      <Input defaultValue="FlexPass Technologies" readOnly className="border-green-400 text-green-700 font-medium" />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Referral code</label>
      <Input disabled placeholder="Not available" />
    </div>
  );
}
