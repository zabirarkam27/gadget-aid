import { Link } from "react-router-dom";

const Error = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 text-center">
      <div>
        <img src="/404.png" className="w-96 mx-auto" />
        <h1 className="text-6xl font-extrabold text-error">Oops!</h1>
        <p className="text-error/80 mt-4 mb-10">
          We couldn't find the page you were looking for.
        </p>
        <Link to="/" className="btn btn-primary">
          Go to Home
        </Link>
      </div>
    </div>
  );
};

export default Error;
