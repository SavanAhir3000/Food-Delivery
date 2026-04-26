import "./Footer.css";
import { assets } from "../../assets/frontend_assets/assets";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const Footer = () => {
  const navigate = useNavigate();

  const goHomeHero = () => {
    navigate("/");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
  };

  const goOrderPage = () => {
    navigate("/myorders");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
  };

  return (
    <div className="footer" id="footer">
      <div className="footer-content">
        <div className="footer-content-left">
          <img src={assets.logo} alt="BiteBlitz Logo" className="bg-white rounded-[10px]" style={{ padding: '4px 12px' }} />
          <p>
            BiteBlitz is a robust, single-vendor food delivery application designed to empower a specific restaurant or cloud kitchen with full control over the digital ordering experience. By moving away from third-party aggregators, BiteBlitz provides a direct connection between the brand and the customer, enabling personalized loyalty programs, data ownership, and higher profit margins.
          </p>
        </div>
        <div className="footer-content-center">
          <h2>Company</h2>
          <ul>
            <li onClick={goHomeHero}>Home</li>
            <li onClick={goOrderPage}>Delivery</li>
            <li onClick={() => navigate("/privacy-policy")}>Privacy Policy</li>
          </ul>
        </div>
        <div className="footer-content-right">
          <h2>Get in touch</h2>
          <ul>
            <li style={{ cursor: "pointer" }} onClick={() => toast.success("Copied Phone Number!")}>+91 9726927561</li>
            <li style={{ cursor: "pointer" }} onClick={() => window.location.href = "mailto:info@biteblitz.com"}>info@biteblitz.com</li>
          </ul>
        </div>
      </div>
      <hr />
      <p className="footer-copyright">
        Copyright 2025 @ BiteBlitz.com - All Right Reserved.
      </p>
    </div>
  );
};

export default Footer;
