import { Helmet } from 'react-helmet-async';
import PopularServices from '../components/PopularServices';
import Banner from '../components/Banner';
import FeaturedSection from '../components/FeaturedSection';
import AboutUs from '../components/AboutUs';
import HowItWorks from '../components/HowItWorks';

const Home = () => {
    return (
      <>
        <Helmet>
          <title>Home || GadgetAid</title>
        </Helmet>
        <Banner></Banner>
        <PopularServices></PopularServices>
        <FeaturedSection></FeaturedSection>
        <AboutUs></AboutUs>
        <HowItWorks></HowItWorks>
      </>
    );
};

export default Home;