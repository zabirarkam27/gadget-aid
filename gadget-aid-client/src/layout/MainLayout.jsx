import { HelmetProvider } from "react-helmet-async";
import Navbar from "../components/Navbar";
import { Outlet } from "react-router-dom";
import Footer from '../components/Footer';

const MainLayout = () => {
    return (
        <HelmetProvider>
            <Navbar></Navbar>
            <Outlet></Outlet>
            <Footer></Footer>
        </HelmetProvider>
    );
};

export default MainLayout;