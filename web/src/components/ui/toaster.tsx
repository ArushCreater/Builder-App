import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";
import { useToast } from "./use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast 
            key={id} 
            variant={variant ?? "success"} 
            duration={2200} 
            {...props}
          >
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {variant === "destructive" ? (
                  <svg
                    className="h-14 w-14 text-red-500"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                  >
                    <circle
                      cx="26"
                      cy="26"
                      r="23"
                      fill="rgba(254, 242, 242, 0.96)"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 145,
                        strokeDashoffset: 145,
                        animation: "toast-ring-draw 0.55s ease-out forwards",
                      }}
                    />
                    <path
                      d="M18 18l16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 23,
                        strokeDashoffset: 23,
                        animation: "toast-line-draw 0.32s 0.34s ease-out forwards",
                      }}
                    />
                    <path
                      d="M34 18L18 34"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 23,
                        strokeDashoffset: 23,
                        animation: "toast-line-draw 0.32s 0.5s ease-out forwards",
                      }}
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-14 w-14 text-emerald-500"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                  >
                    <circle
                      cx="26"
                      cy="26"
                      r="23"
                      fill="rgba(236, 253, 245, 0.98)"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 145,
                        strokeDashoffset: 145,
                        animation: "toast-ring-draw 0.55s ease-out forwards",
                      }}
                    />
                    <path
                      fill="none"
                      d="M16.5 26.5l6.3 6.7L35.5 20.5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        strokeDasharray: 30,
                        strokeDashoffset: 30,
                        animation: "toast-check-draw 0.45s 0.38s ease-out forwards",
                      }}
                    />
                  </svg>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1 text-left animate-toast-copy-in">
                {title && (
                  <ToastTitle className={variant === "destructive" ? "text-base font-semibold tracking-tight text-red-700" : "text-base font-semibold tracking-tight text-emerald-700"}>
                    {title}
                  </ToastTitle>
                )}
                {description && (
                  <ToastDescription className={variant === "destructive" ? "text-sm font-medium text-red-600/85" : "text-sm font-medium text-emerald-600/85"}>
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>

            {action}
            <ToastClose className={variant === "destructive" ? "text-red-300 hover:text-red-500 focus:ring-red-200" : "text-emerald-300 hover:text-emerald-500 focus:ring-emerald-200"} />

            <style>{`
              @keyframes toast-ring-draw {
                0% { stroke-dashoffset: 145; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes toast-check-draw {
                0% { stroke-dashoffset: 30; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes toast-line-draw {
                0% { stroke-dashoffset: 23; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes toast-copy-in {
                0% { opacity: 0; transform: translateY(8px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              .animate-toast-copy-in {
                animation: toast-copy-in 0.45s 0.18s ease-out forwards;
                opacity: 0;
              }
            `}</style>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
