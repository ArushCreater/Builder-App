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
          <Toast key={id} variant={variant ?? "success"} {...props}>
            <div className="flex flex-col items-center justify-center gap-3 text-center w-full">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-16 w-16 rounded-full bg-emerald-200/60 animate-ping" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              </div>
              <div className="grid gap-1">
                <ToastTitle className="text-xl font-semibold text-emerald-900">
                  {title || "Success"}
                </ToastTitle>
                {description && (
                  <ToastDescription className="text-sm text-emerald-700">
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose className="text-gray-400 hover:text-gray-600" />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
