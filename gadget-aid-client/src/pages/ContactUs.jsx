import { Helmet } from "react-helmet-async";

const ContactUs = () => {
  return (
    <div className="min-h-screen bg-base-200 px-4 py-12">
      <Helmet>
        <title>Contact Us | GadgetAid</title>
      </Helmet>
      <div className="max-w-2xl mx-auto bg-base-100 rounded-xl shadow-xl p-8 text-center border border-base-300">
        <h2 className="text-3xl font-bold mb-4 text-primary">Contact Us</h2>
        <p className="text-base-content/70 mb-2">
          Have a question or need help with a repair? Reach out any time.
        </p>
        <p className="text-base-content font-medium">support@gadgetaid.com</p>
      </div>
    </div>
  );
};

export default ContactUs;
