export default function SettingsPage() {
    return (
      <div className="max-w-xl">
         <h1 className="text-2xl font-bold text-slate-900 mb-6">Account Settings</h1>
         
         <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4 opacity-50 pointer-events-none">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" className="w-full p-2 border rounded-lg bg-slate-50" value="FlexPass Host" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="text" className="w-full p-2 border rounded-lg bg-slate-50" value="host@gmail.com" readOnly />
            </div>
            <p className="text-xs text-slate-500 pt-2">Editing profile details is coming soon.</p>
         </div>
      </div>
    );
  }