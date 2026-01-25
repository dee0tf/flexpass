import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
    try {
        // Attempt to select one row from tickets to see the structure
        // We select * so we get ALL columns including user_name if it exists
        const { data, error } = await supabase
            .from("tickets")
            .select("*")
            .limit(1);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // If no data, we can't be 100% sure of columns just by selecting *, 
        // but typically you'd need at least one row or check the error if we try to select a specific column.

        // Let's try to explicitly select 'user_name' to fail if it doesn't exist
        const { error: colError } = await supabase
            .from("tickets")
            .select("user_name")
            .limit(1);

        return NextResponse.json({
            tickets_data: data,
            has_user_name_column: !colError,
            column_check_error: colError ? colError.message : null
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
