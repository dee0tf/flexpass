"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
    Loader2, Calendar, MapPin, DollarSign,
    Image as ImageIcon, Type, Clock, Hash,
    AlertCircle, User, Trash2
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { use } from "react";

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        date: "",
        start_time: "",
        location: "",
        price: "",
        total_tickets: "",
        sales_end_date: "",
        organizer_name: "",
        image_url: "",
        category: "Music",
    });

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert("Please login");
                router.push("/login");
                return;
            }
            setUser(user);

            // Simple Admin Check (e.g., check metadata or specific email)
            // For now, we'll check a custom metadata field 'role' OR a hardcoded email for testing
            const isSuperAdmin = user.user_metadata?.role === 'admin' || user.email === 'admin@flexpass.com';
            setIsAdmin(isSuperAdmin);

            // Fetch Event
            const { data: event, error } = await supabase
                .from("events")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {
                alert("Event not found");
                router.push("/dashboard");
                return;
            }

            // Authorization: Only owner OR Admin can edit
            if (event.user_id !== user.id && !isSuperAdmin) {
                alert("You are not authorized to edit this event.");
                router.push("/dashboard");
                return;
            }

            setFormData({
                title: event.title,
                description: event.description || "",
                date: event.date,
                start_time: event.start_time || "",
                location: event.location,
                price: event.price.toString(),
                total_tickets: event.total_tickets?.toString() || "",
                sales_end_date: event.sales_end_date ? new Date(event.sales_end_date).toISOString().slice(0, 16) : "",
                organizer_name: event.organizer_name || "",
                image_url: event.image_url || "",
                category: event.category || "Music",
            });
            setIsLoading(false);
        }
        loadData();
    }, [id, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const { error } = await supabase.from("events").update({
                title: formData.title,
                description: formData.description,
                date: formData.date,
                start_time: formData.start_time,
                location: formData.location,
                price: Number(formData.price),
                total_tickets: Number(formData.total_tickets),
                sales_end_date: formData.sales_end_date,
                organizer_name: formData.organizer_name,
                image_url: formData.image_url,
                category: formData.category,
            }).eq("id", id);

            if (error) throw error;

            alert("✨ Event Updated Successfully!");
            router.push("/dashboard");

        } catch (error: any) {
            console.error("Error:", error);
            alert("Failed to update event: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to DELETE this event? This action cannot be undone.")) return;

        setIsDeleting(true);
        const { error } = await supabase.from("events").delete().eq("id", id);

        if (error) {
            alert("Failed to delete: " + error.message);
            setIsDeleting(false);
        } else {
            alert("Event deleted.");
            router.push("/dashboard");
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    if (isLoading) return <div className="p-10 text-center">Loading event...</div>;

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-slate-900">Edit Event</h1>
                </div>

                <div className="bg-white shadow-xl rounded-3xl overflow-hidden border border-slate-100">
                    <form onSubmit={handleSubmit} className="p-8 space-y-8">

                        {/* Reuse Section 1: Event Details */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                                <Calendar className="h-5 w-5 text-[#f97316]" /> Event Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
                                    <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200" required />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full p-3 rounded-xl border border-slate-200" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                                    <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200" required />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                    <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200" required />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Ticketing */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2 pt-4">
                                <DollarSign className="h-5 w-5 text-[#f97316]" /> Ticketing
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Price (₦)</label>
                                    <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200" required />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Branding */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2 pt-4">
                                <ImageIcon className="h-5 w-5 text-[#f97316]" /> Branding
                            </h2>
                            <div className="w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Event Image</label>
                                <ImageUpload
                                    onUpload={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                                    defaultValue={formData.image_url}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-6 text-right">
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition flex items-center gap-2"
                                >
                                    {isDeleting ? <Loader2 className="animate-spin h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
                                    Delete Event (Admin)
                                </button>
                            )}

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 bg-[#581c87] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#4c1d75] transition flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
