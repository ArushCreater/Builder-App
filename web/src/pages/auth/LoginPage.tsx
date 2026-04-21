import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck, Hammer, Building2, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';

function AuroraBackground({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const dark = variant === 'dark';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      <div
        className={`absolute inset-0 ${
          dark ? 'bg-slate-950' : 'bg-white'
        }`}
      />
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-blob aurora-blob-4" />
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const validateForm = () => {
    const next: { email?: string; password?: string } = {};
    if (!formData.email) next.email = 'Email is required';
    if (!formData.password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await login(formData.email, formData.password);
      setTransitioning(true);
      window.setTimeout(() => {
        navigate('/dashboard');
      }, 750);
    } catch (error: any) {
      toast({
        title: 'Sign-in failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name as keyof typeof errors]) {
      setErrors({ ...errors, [e.target.name]: undefined });
    }
  };

  return (
    <>
      <style>{auroraCss}</style>
      <div className="min-h-screen grid lg:grid-cols-2 relative">
        {/* Left decorative panel */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden text-white p-12">
          <AuroraBackground variant="dark" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] z-[1]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.25) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 40%, rgba(2,6,23,0.55) 100%)',
            }}
          />

          <div className="relative z-10">
            <div className="flex items-end gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-300 flex items-center justify-center text-slate-900 font-bold text-lg">
                  B
                </div>
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-3xl font-extrabold tracking-tight">BuilderOS</span>
                <span className="mt-1 self-end text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  powered by Baaz Homes
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-lg">
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Every project, every crew,
              <span className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                {' '}one source of truth.
              </span>
            </h2>
            <p className="mt-4 text-slate-300 text-base leading-relaxed">
              Schedule, budget, and deliver builds faster — from lead intake to final walkthrough.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center gap-3 text-slate-200">
                <span className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-indigo-300" />
                </span>
                Live project dashboards and timelines
              </li>
              <li className="flex items-center gap-3 text-slate-200">
                <span className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                  <Hammer className="h-4 w-4 text-cyan-300" />
                </span>
                Daily logs, selections, and documents in one place
              </li>
              <li className="flex items-center gap-3 text-slate-200">
                <span className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                </span>
                Enterprise-grade security with Supabase Auth
              </li>
            </ul>
          </div>

          <div className="relative z-10 text-xs text-slate-400">
            © {new Date().getFullYear()} Baaz Homes. All rights reserved.
          </div>
        </div>

        {/* Right form panel */}
        <div className="relative flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="absolute inset-0 lg:hidden overflow-hidden">
            <AuroraBackground variant="light" />
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xl" />
          </div>
          <div className="hidden lg:block absolute inset-0 bg-white" />
          <div className="relative w-full max-w-md">
            {/* Mobile brand */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="flex items-end gap-3">
                <div className="h-11 w-11 rounded-2xl bg-slate-900 flex items-center justify-center">
                  <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-300 flex items-center justify-center text-slate-900 font-bold">
                    B
                  </div>
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-2xl font-extrabold tracking-tight text-slate-900">BuilderOS</span>
                  <span className="mt-1 self-end text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    powered by Baaz Homes
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-500">
                Sign in to continue to your dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading || transitioning}
                    className={`h-12 pl-10 rounded-xl border-slate-200 bg-slate-50/60 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:border-indigo-400 transition ${
                      errors.email ? 'border-red-300 focus-visible:ring-red-200 focus-visible:border-red-400' : ''
                    }`}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700">Password</Label>
                  <span className="text-xs text-slate-400">Contact admin to reset</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading || transitioning}
                    className={`h-12 pl-10 pr-11 rounded-xl border-slate-200 bg-slate-50/60 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:border-indigo-400 transition ${
                      errors.password ? 'border-red-300 focus-visible:ring-red-200 focus-visible:border-red-400' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading || transitioning}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-lg shadow-slate-900/20 transition"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>

              <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Accounts are provisioned by your administrator.
              </div>
            </form>

            <p className="mt-10 text-center text-xs text-slate-400">
              © {new Date().getFullYear()} Baaz Homes · BuilderOS
            </p>
          </div>
        </div>

        {/* Success → dashboard transition overlay */}
        {transitioning && (
          <div className="fixed inset-0 z-50 overflow-hidden login-transition-overlay">
            <AuroraBackground variant="dark" />
            <div className="absolute inset-0 bg-slate-950/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-5 transition-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-2xl animate-pulse" />
                  <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-xl flex items-center justify-center">
                    <Check className="h-8 w-8 text-white" strokeWidth={3} />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white text-xl font-semibold tracking-tight">Welcome back</div>
                  <div className="text-slate-300 text-sm mt-1">Taking you to your dashboard…</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const auroraCss = `
.aurora-blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  will-change: transform;
  mix-blend-mode: screen;
  opacity: 0.55;
}
.aurora-blob-1 {
  width: 55%;
  aspect-ratio: 1/1;
  left: -10%;
  top: -15%;
  background: radial-gradient(circle, #6366f1 0%, rgba(99,102,241,0) 60%);
  animation: aurora-drift-1 22s ease-in-out infinite;
}
.aurora-blob-2 {
  width: 50%;
  aspect-ratio: 1/1;
  right: -10%;
  top: 20%;
  background: radial-gradient(circle, #06b6d4 0%, rgba(6,182,212,0) 60%);
  animation: aurora-drift-2 26s ease-in-out infinite;
}
.aurora-blob-3 {
  width: 60%;
  aspect-ratio: 1/1;
  left: 10%;
  bottom: -20%;
  background: radial-gradient(circle, #a855f7 0%, rgba(168,85,247,0) 60%);
  animation: aurora-drift-3 30s ease-in-out infinite;
}
.aurora-blob-4 {
  width: 45%;
  aspect-ratio: 1/1;
  right: 10%;
  bottom: -10%;
  background: radial-gradient(circle, #10b981 0%, rgba(16,185,129,0) 60%);
  animation: aurora-drift-4 34s ease-in-out infinite;
}
@keyframes aurora-drift-1 {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50% { transform: translate3d(10%, 8%, 0) scale(1.15); }
}
@keyframes aurora-drift-2 {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50% { transform: translate3d(-12%, 10%, 0) scale(1.1); }
}
@keyframes aurora-drift-3 {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50% { transform: translate3d(8%, -12%, 0) scale(1.2); }
}
@keyframes aurora-drift-4 {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50% { transform: translate3d(-10%, -8%, 0) scale(1.15); }
}
@media (prefers-reduced-motion: reduce) {
  .aurora-blob { animation: none !important; }
}
.login-transition-overlay {
  animation: overlay-fade-in 450ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes overlay-fade-in {
  from { opacity: 0; backdrop-filter: blur(0px); }
  to { opacity: 1; backdrop-filter: blur(8px); }
}
.transition-center {
  animation: transition-pop 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes transition-pop {
  0% { opacity: 0; transform: scale(0.85) translateY(10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
`;

export default LoginPage;
