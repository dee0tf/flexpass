"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LogIn, ArrowLeft } from "lucide-react";

interface AuthModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    redirectPath?: string; // Where to go after login (optional, but good for future)
}

export default function AuthModal({
    open,
    onOpenChange,
    title = "Login Required",
    description = "You need to be logged in to access this feature.",
    redirectPath = "/login"
}: AuthModalProps) {
    const router = useRouter();

    const handleLogin = () => {
        // In a real app, we might save current path to redirect back later
        router.push(redirectPath);
        onOpenChange(false);
    };

    const handleCancel = () => {
        onOpenChange(false);
        router.push("/"); // Go home if cancelled
    };

    // Handle direct close (clicking outside)
    const handleOpenChange = (isOpen: boolean) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            router.push("/");
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6">
                <DialogHeader className="text-center space-y-4">
                    <div className="mx-auto bg-purple-100 p-3 rounded-full w-16 h-16 flex items-center justify-center">
                        <LogIn className="h-8 w-8 text-[#581c87]" />
                    </div>
                    <DialogTitle className="text-2xl font-bold text-slate-900">{title}</DialogTitle>
                    <DialogDescription className="text-slate-500 max-w-xs mx-auto">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 mt-6">
                    <Button
                        onClick={handleLogin}
                        className="w-full bg-gradient-to-r from-[#f97316] to-[#581c87] text-white font-bold py-6 rounded-xl hover:opacity-90 transition shadow-lg shadow-purple-100 text-lg"
                    >
                        Log In Now
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={handleCancel}
                        className="w-full text-slate-500 font-medium hover:bg-slate-50 rounded-xl py-6"
                    >
                        Maybe Later
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
