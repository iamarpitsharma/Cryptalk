import * as React from "react";

const Input = React.forwardRef(({ className = "", type, ...props }, ref) => {
  const baseClasses =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

  const combinedClasses = `${baseClasses} ${className}`.trim();

  return <input type={type} className={combinedClasses} ref={ref} {...props} />;
});

Input.displayName = "Input";

export { Input };

// import React, { forwardRef } from "react";

// export const Input = forwardRef(({ className = "", ...props }, ref) => {
//   return (
//     <input
//       ref={ref}
//       className={`rounded-md border border-gray-600 bg-gray-700/50 px-3 py-2 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400/30 focus:outline-none focus:ring-1 ${className}`}
//       {...props}
//     />
//   );
// });
