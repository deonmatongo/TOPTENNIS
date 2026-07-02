
interface AuthBackgroundProps {
  children: React.ReactNode;
}

const AuthBackground = ({ children }: AuthBackgroundProps) => {
  return (
    <section className="relative w-full min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-100 via-white to-orange-50">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
      </div>
      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        {children}
      </div>
    </section>
  );
};

export default AuthBackground;
