"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Upload, Loader2, X, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ImageUploadProps {
    onUpload: (url: string) => void;
    defaultValue?: string;
}

export default function ImageUpload({ onUpload, defaultValue = "" }: ImageUploadProps) {
    const [imageUrl, setImageUrl] = useState(defaultValue);
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!e.target.files || e.target.files.length === 0) {
                throw new Error("You must select an image to upload.");
            }

            const file = e.target.files[0];
            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("event-images")
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from("event-images")
                .getPublicUrl(filePath);

            setImageUrl(data.publicUrl);
            onUpload(data.publicUrl);
        } catch (error: any) {
            alert("Error uploading image: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = () => {
        setImageUrl("");
        onUpload("");
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
                {imageUrl ? (
                    <div className="relative w-full h-64 rounded-xl overflow-hidden border border-slate-200 group">
                        <Image
                            src={imageUrl}
                            alt="Uploaded event image"
                            fill
                            className="object-cover"
                        />
                        <button
                            onClick={handleRemove}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            type="button"
                        >
                            <X size={20} />
                        </button>
                    </div>
                ) : (
                    <label
                        htmlFor="dropzone-file"
                        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""
                            }`}
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploading ? (
                                <>
                                    <Loader2 className="w-10 h-10 mb-3 text-[#581c87] animate-spin" />
                                    <p className="mb-2 text-sm text-slate-500">Uploading...</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 mb-3 text-slate-400" />
                                    <p className="mb-2 text-sm text-slate-500">
                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                    </p>
                                    <p className="text-xs text-slate-500">SVG, PNG, JPG or GIF (MAX. 5MB)</p>
                                </>
                            )}
                        </div>
                        <input
                            id="dropzone-file"
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                    </label>
                )}
            </div>
        </div>
    );
}
