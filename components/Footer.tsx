import Link from "next/link";
import { Twitter, Instagram, Facebook, Mail, ArrowRight, Loader2, Check } from "lucide-react";
import Logo from "./Logo";
import { useState } from "react";

export default function Footer() {
    const currentYear = new Date().getFullYear();
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");
        try {
            const res = await fetch("/api/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus("success");
                setMessage(data.message);
                setEmail("");
            } else {
                setStatus("error");
                setMessage(data.error || "Something went wrong");
            }
        } catch (err) {
            setStatus("error");
            setMessage("Failed to connect. Please try again.");
        }
    };

    return (
        <footer className="bg-[#0F172A] text-slate-300 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800 relative overflow-hidden">
            {/* Background Gradient Blurs */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-flex-purple/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-flex-orange/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16 relative z-10">
                {/* Brand Column */}
                <div className="space-y-6">
                    <Link href="/">
                        <Logo type="full" className="brightness-0 invert" />
                    </Link>
                    <p className="text-slate-400 leading-relaxed text-sm">
                        Experience the future of events in Nigeria. Secure tickets, seamless entry, and unforgettable moments.
                    </p>
                    <div className="flex items-center gap-4">
                        <a href="#" className="bg-slate-800 p-2.5 rounded-full hover:bg-[#581c87] hover:text-white transition-all text-slate-400">
                            <Twitter size={18} />
                        </a>
                        <a href="#" className="bg-slate-800 p-2.5 rounded-full hover:bg-[#f97316] hover:text-white transition-all text-slate-400">
                            <Instagram size={18} />
                        </a>
                        <a href="#" className="bg-slate-800 p-2.5 rounded-full hover:bg-blue-600 hover:text-white transition-all text-slate-400">
                            <Facebook size={18} />
                        </a>
                    </div>
                </div>

                {/* Product & Company (Merged for space) */}
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-white font-bold text-lg mb-6">Product</h3>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/events" className="hover:text-[#f97316] transition-colors">Find Events</Link></li>
                            <li><Link href="/create" className="hover:text-[#f97316] transition-colors">Host Event</Link></li>
                            <li><Link href="#" className="hover:text-[#f97316] transition-colors">Pricing</Link></li>
                            <li><Link href="#" className="hover:text-[#f97316] transition-colors">Features</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg mb-6">Company</h3>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="#" className="hover:text-[#581c87] transition-colors">About</Link></li>
                            <li><Link href="#" className="hover:text-[#581c87] transition-colors">Careers</Link></li>
                            <li><Link href="#" className="hover:text-[#581c87] transition-colors">Blog</Link></li>
                            <li><Link href="#" className="hover:text-[#581c87] transition-colors">Contact</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Resources */}
                <div>
                    <h3 className="text-white font-bold text-lg mb-6">Resources</h3>
                    <ul className="space-y-3 text-sm">
                        <li><Link href="#" className="hover:text-white transition-colors">Help Center</Link></li>
                        <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                        <li><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></li>
                        <li><Link href="#" className="hover:text-white transition-colors">Cookies</Link></li>
                    </ul>
                </div>

                {/* Newsletter Subscription */}
                <div className="lg:col-span-1">
                    <h3 className="text-white font-bold text-lg mb-4">Stay in the loop</h3>
                    <p className="text-slate-400 text-sm mb-6">
                        Join our newsletter to get the latest updates on events and exclusive offers.
                    </p>
                    <form onSubmit={handleSubscribe} className="space-y-3">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={status === "loading" || status === "success"}
                                className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#581c87] focus:ring-1 focus:ring-[#581c87] transition-all disabled:opacity-50"
                            />
                        </div>

                        {status === "success" ? (
                            <div className="w-full bg-green-500/10 text-green-400 border border-green-500/20 py-3 rounded-xl font-medium flex items-center justify-center gap-2">
                                <Check size={18} /> {message}
                            </div>
                        ) : (
                            <button
                                disabled={status === "loading"}
                                className="w-full bg-gradient-to-r from-[#f97316] to-[#581c87] text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {status === "loading" ? <Loader2 className="animate-spin" size={18} /> : <>Subscribe <ArrowRight size={18} /></>}
                            </button>
                        )}

                        {status === "error" && (
                            <p className="text-red-400 text-xs">{message}</p>
                        )}
                    </form>
                </div>
            </div>

            <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 relative z-10">
                <p>&copy; {currentYear} FlexPass. All rights reserved.</p>
                <div className="flex items-center gap-6">
                    <span>Made with ❤️ in Lagos</span>
                </div>
            </div>
        </footer>
    );
}
