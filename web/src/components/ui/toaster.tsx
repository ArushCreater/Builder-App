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
            duration={700} 
            {...props}
            className="flex flex-col items-center justify-center border-none shadow-none bg-transparent p-0"
          >
            <div className="flex flex-col items-center justify-center">
              {/* Success Tick Animation */}
              <div className="relative flex items-center justify-center mb-2">
                 <svg 
                   className="w-20 h-20 text-emerald-500" 
                   viewBox="0 0 52 52"
                 >
                   <circle 
                     className="animate-circle-draw"
                     cx="26" 
                     cy="26" 
                     r="25" 
                     fill="none" 
                     stroke="currentColor" 
                     strokeWidth="2" // Thinner stroke for elegance
                     strokeLinecap="round"
                     style={{
                        strokeDasharray: 166,
                        strokeDashoffset: 166,
                        animation: 'circle-draw 0.4s ease-in-out forwards'
                     }}
                   />
                   <path 
                     className="animate-tick-draw" 
                     fill="none" 
                     d="M14.1 27.2l7.1 7.2 16.7-16.8" 
                     stroke="currentColor" 
                     strokeWidth="2" // Match circle stroke
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     style={{
                        strokeDasharray: 48,
                        strokeDashoffset: 48,
                        animation: 'tick-draw 0.3s 0.4s ease-out forwards'
                     }}
                   />
                 </svg>
              </div>

              {/* Text Content */}
              <div className="flex flex-col items-center gap-1 text-center animate-fade-in-up">
                {title && (
                  <ToastTitle className="text-xl font-medium text-emerald-600 tracking-tight">
                    {title}
                  </ToastTitle>
                )}
                {description && (
                  <ToastDescription className="text-sm font-medium text-emerald-500/80">
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            
            {/* Hidden but kept for accessibility/structure if needed */}
            <div className="hidden">
                {action}
                <ToastClose />
            </div>

            <style>{`
              @keyframes circle-draw {
                0% { stroke-dashoffset: 166; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes tick-draw {
                0% { stroke-dashoffset: 48; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes fade-in-up {
                0% { opacity: 0; transform: translateY(10px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              .animate-fade-in-up {
                animation: fade-in-up 0.4s 0.2s ease-out forwards;
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
