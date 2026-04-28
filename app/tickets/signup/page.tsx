"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowRight, Mail, Eye, EyeOff, User,
  Building2, CheckCircle2, AlertCircle, Instagram, Globe,
} from "lucide-react";

const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank", code: "023" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Globus Bank", code: "00103" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "OPay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Creator / host fields
  const [hostName, setHostName] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");

  // Bank fields
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [bankError, setBankError] = useState("");
  const skipNextVerify = useRef(false);

  // ToS
  const [agreedToTos, setAgreedToTos] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (skipNextVerify.current) { skipNextVerify.current = false; return; }
    if (bankCode && accountNumber.length === 10) {
      verifyBankAccount();
    } else {
      setBankVerified(false);
      setAccountName("");
      setBankError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, accountNumber]);

  const verifyBankAccount = async () => {
    setVerifying(true);
    setBankVerified(false);
    setAccountName("");
    setBankError("");
    try {
      const res = await fetch(`/api/paystack/resolve-account?account_number=${accountNumber}&bank_code=${bankCode}`);
      const data = await res.json();
      if (res.ok && data.account_name) {
        setAccountName(data.account_name);
        setBankVerified(true);
      } else {
        setBankError("Could not verify account. Check details and try again.");
      }
    } catch {
      setBankError("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const validateEmail = (val: string) => {
    if (!val) return;
    if (!emailRegex.test(val)) setEmailError("Please enter a valid email address.");
    else setEmailError("");
  };

  const validatePasswords = (pw: string, cpw: string) => {
    if (cpw && pw !== cpw) setPasswordError("Passwords do not match.");
    else setPasswordError("");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRegex.test(email)) { setEmailError("Please enter a valid email address."); return; }
    if (password !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!agreedToTos) { setError("Please agree to the Terms of Service to continue."); return; }

    const bankPartiallyFilled = bankCode || accountNumber;
    if (bankPartiallyFilled && !bankVerified) {
      setError("Please complete and verify your bank details, or leave both fields empty.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            gender,
            host_name: hostName || fullName,
            instagram_url: instagramUrl,
            tiktok_url: tiktokUrl,
            twitter_url: twitterUrl,
          },
          emailRedirectTo: `${siteUrl}/auth/confirmed`,
        },
      });
      if (signupError) throw signupError;

      if (bankVerified && accountName && data.user) {
        const selectedBank = NIGERIAN_BANKS.find(b => b.code === bankCode);
        await supabase.from("bank_accounts").upsert({
          user_id: data.user.id,
          bank_name: selectedBank?.name || bankCode,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
          recipient_code: null,
        }, { onConflict: "user_id" });

        if (data.session) {
          fetch("/api/paystack/subaccount", {
            method: "POST",
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          }).catch(() => {});
        }
      }

      if (!data.session) { setEmailSent(true); return; }
      window.location.href = "/dashboard";

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-full max-w-md text-center">
          <div className="rounded-3xl shadow-xl p-10" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="h-16 w-16 bg-[#480082]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Mail className="h-8 w-8 text-[#480082]" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Check your inbox</h2>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              We sent a confirmation link to{" "}
              <strong className="text-[#480082]">{email}</strong>. Click it to activate your account.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 text-[#480082] font-semibold hover:text-[#9F67FE] transition-colors text-sm">
              Back to Login <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition";
  const inputStyle = { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-lg">
        <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="h-1.5 w-full grad-brand" />
          <div className="p-8">
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Join FlexPass</h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>Start selling tickets today — it&apos;s free</p>

            <form onSubmit={handleSignup} className="space-y-5">

              {/* ── Personal Info ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                    <input type="text" required placeholder="John Doe" value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className={`${inputClass} pl-10`} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Gender</label>
                  <select required value={gender} onChange={e => setGender(e.target.value)}
                    className={inputClass} style={inputStyle}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Host / Brand Name</label>
                  <input type="text" placeholder="e.g. Vibe Africa" value={hostName}
                    onChange={e => setHostName(e.target.value)}
                    className={inputClass} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                  <input type="email" required placeholder="you@example.com" value={email}
                    onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                    onBlur={() => validateEmail(email)}
                    className={`${inputClass} pl-10 ${emailError ? "ring-2 ring-red-400" : ""}`}
                    style={{ ...inputStyle, border: `1px solid ${emailError ? "#f87171" : "var(--input-border)"}` }} />
                </div>
                {emailError && <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5"><AlertCircle size={12} /> {emailError}</p>}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required minLength={8}
                    placeholder="Min. 8 characters" value={password}
                    onChange={e => { setPassword(e.target.value); validatePasswords(e.target.value, confirmPassword); }}
                    className={`${inputClass} pr-12`} style={inputStyle} />
                  <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                    className="absolute right-3 top-3.5 p-0.5 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
                <div className="relative">
                  <input type={showConfirm ? "text" : "password"} required
                    placeholder="Re-enter your password" value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); validatePasswords(password, e.target.value); }}
                    className={`${inputClass} pr-12 ${passwordError ? "ring-2 ring-red-400" : ""}`}
                    style={{ ...inputStyle, border: `1px solid ${passwordError ? "#f87171" : "var(--input-border)"}` }} />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}
                    className="absolute right-3 top-3.5 p-0.5 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordError && <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5"><AlertCircle size={12} /> {passwordError}</p>}
              </div>

              {/* ── Social Media (optional) ── */}
              <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Social Media <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional — shown on your events)</span>
                  </p>
                </div>
                {[
                  { label: "Instagram URL", value: instagramUrl, setter: setInstagramUrl, placeholder: "https://instagram.com/yourpage" },
                  { label: "TikTok URL", value: tiktokUrl, setter: setTiktokUrl, placeholder: "https://tiktok.com/@yourpage" },
                  { label: "Twitter / X URL", value: twitterUrl, setter: setTwitterUrl, placeholder: "https://x.com/yourhandle" },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                    <input type="url" placeholder={f.placeholder} value={f.value}
                      onChange={e => f.setter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition"
                      style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }} />
                  </div>
                ))}
              </div>

              {/* ── Bank Details (optional) ── */}
              <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Bank Details <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional — for receiving payouts)</span>
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Bank</label>
                  <select value={bankCode} onChange={e => setBankCode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition"
                    style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}>
                    <option value="">Select your bank</option>
                    {NIGERIAN_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Account Number</label>
                  <input type="text" inputMode="numeric" maxLength={10} placeholder="0123456789"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition"
                    style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }} />
                </div>
                <div className="relative">
                  <input readOnly value={verifying ? "Verifying..." : accountName}
                    placeholder="Account name auto-fills after verification"
                    className="w-full px-3 py-2.5 pr-9 rounded-xl text-sm"
                    style={{ backgroundColor: "var(--surface)", border: `1px solid ${bankVerified ? "#4ade80" : "var(--card-border)"}`, color: bankVerified ? "#16a34a" : "var(--text-muted)", fontWeight: bankVerified ? 600 : 400 }} />
                  <div className="absolute right-3 top-2.5">
                    {verifying && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} />}
                    {bankVerified && !verifying && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </div>
                </div>
                {bankError && <p className="flex items-center gap-1 text-red-500 text-xs"><AlertCircle size={12} /> {bankError}</p>}
              </div>

              {/* ── Terms of Service ── */}
              <div className="flex items-start gap-3">
                <input type="checkbox" id="tos" checked={agreedToTos} onChange={e => setAgreedToTos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#480082] cursor-pointer flex-shrink-0" />
                <label htmlFor="tos" className="text-sm cursor-pointer leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  I have read and agree to the{" "}
                  <Link href="/tos" target="_blank" className="font-semibold underline hover:no-underline" style={{ color: "var(--brand-indigo)" }}>
                    Terms of Service
                  </Link>{" "}and{" "}
                  <Link href="/privacy" target="_blank" className="font-semibold underline hover:no-underline" style={{ color: "var(--brand-indigo)" }}>
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {error && (
                <p className="flex items-center gap-2 text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">
                  <AlertCircle size={15} /> {error}
                </p>
              )}

              <button disabled={isLoading || !!emailError || !!passwordError}
                className="w-full bg-[#FFB700] text-[#0E0D0D] py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 hover:bg-[#e6a500] disabled:opacity-60">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create Account <ArrowRight size={18} /></>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Already have an account?{" "}
              <Link href="/login" className="text-[#480082] font-semibold hover:text-[#9F67FE] transition-colors">Log in</Link>
            </p>
          </div>
        </div>
        <p className="text-center mt-6 text-xs" style={{ color: "var(--text-muted)" }}>Tap, Flex, Enter, Repeat.</p>
      </div>
    </div>
  );
}
