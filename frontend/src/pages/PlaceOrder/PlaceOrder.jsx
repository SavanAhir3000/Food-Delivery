import React, { useContext, useEffect, useState } from "react";
import "./PlaceOrder.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from 'react-router-dom';
import Autocomplete from "react-google-autocomplete";
import { computeTax } from "../../utils/taxUtils";

// Custom hook for count-up animation
const useCountUp = (endValue, duration = 800) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!endValue) {
      setValue(0);
      return;
    }
    const steps = 20;
    const stepTime = duration / steps;
    let current = value;
    const diff = endValue - current;
    if (diff === 0) return;

    const timer = setInterval(() => {
      current += diff / steps;
      if ((diff > 0 && current >= endValue) || (diff < 0 && current <= endValue)) {
        clearInterval(timer);
        setValue(endValue);
      } else {
        setValue(Math.round(current));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [endValue, duration]);
  return value;
};

const PlaceOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderedForSomeoneElse = location.state?.orderForSomeoneElse || false;

  const { getTotalCartAmount, token, food_list, cartItems, setCartItems, url, promoData, userName, userEmail } = useContext(StoreContext);
  
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    city: "",
    state: "",
    zipcode: "",
    country: "",
    phone: "",
  });

  useEffect(() => {
    const persistedEmail = userEmail || localStorage.getItem("userEmail") || "";
    const persistedName = userName || localStorage.getItem("userName") || "";
    const [firstName = "", ...rest] = persistedName.trim().split(" ");
    const lastName = rest.join(" ");
    setData((prev) => ({
      ...prev,
      email: prev.email || persistedEmail,
      firstName: prev.firstName || firstName,
      lastName: prev.lastName || lastName,
    }));
  }, [userEmail, userName]);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [saveAddress, setSaveAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Stripe");
  const [loading, setLoading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [checkoutPromo, setCheckoutPromo] = useState("");
  const [appliedCheckoutPromo, setAppliedCheckoutPromo] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateAddressFields = () => {
    if (selectedAddressId) return {};
    const required = {
      firstName: "First name is required",
      lastName: "Last name is required",
      email: "Email is required",
      street: "Address is required",
      city: "City is required",
      state: "State is required",
      zipcode: "Zip code is required",
      country: "Country is required",
      phone: "Phone is required",
    };
    const errors = {};
    Object.entries(required).forEach(([key, msg]) => {
      if (!String(data[key] || "").trim()) errors[key] = msg;
    });
    return errors;
  };

  const applyCheckoutPromo = () => {
    if (checkoutPromo.trim().toUpperCase() === "BITE20") {
      setAppliedCheckoutPromo("BITE20");
      toast.success("BITE20 applied! 20% off subtotal.");
    } else {
      toast.error("Invalid promo code.");
      setAppliedCheckoutPromo("");
    }
  };

  const calculateDiscount = () => {
    let subtotal = getTotalCartAmount();
    if (subtotal === 0) return 0;
    let discount = 0;
    // Cart Promo
    if (promoData.code && promoData.discountType === "percent") {
      discount += (subtotal * promoData.discountValue) / 100;
    } else if (promoData.code && promoData.discountType === "flat") {
      discount += promoData.discountValue;
    }
    // BITE20 Checkout Promo
    if (appliedCheckoutPromo === "BITE20") {
      discount += subtotal * 0.20;
    }
    return discount;
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Free Nominatim OpenStreetMap Reverse Geocoding API
          const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          
          if (response.data && response.data.address) {
            const addr = response.data.address;
            setData(prev => ({
              ...prev,
              street: addr.road || addr.suburb || addr.neighbourhood || prev.street,
              city: addr.city || addr.town || addr.village || addr.state_district || prev.city,
              state: addr.state || prev.state,
              zipcode: addr.postcode || prev.zipcode,
              country: addr.country || prev.country
            }));
            toast.success("Location auto-filled from your GPS!");
          } else {
            toast.error("Could not determine address from coordinates.");
          }
        } catch (error) {
          console.error("Geocoding Error:", error);
          toast.error("Error fetching location details.");
        } finally {
          setFetchingLocation(false);
        }
      },
      (error) => {
        console.error("GPS Error:", error);
        setFetchingLocation(false);
        toast.error("Please allow location access to use this feature.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    if (loading) return; // Prevent double clicks

    let orderItems = [];
    food_list.map((item) => {
      if (cartItems[item._id] > 0) {
        let itemInfo = JSON.parse(JSON.stringify(item));
        itemInfo["quantity"] = cartItems[item._id];
        orderItems.push(itemInfo);
      }
    });

    if (orderItems.length === 0) {
      toast.error("Your cart is empty. Add items first.", { toastId: "order-empty-cart" });
      return;
    }

    if (!selectedAddressId) {
      const errors = validateAddressFields();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        toast.error("Please fill all required delivery fields.", { toastId: "order-form-invalid" });
        return;
      }
    }

    setLoading(true);

    const effectiveSubtotal = Math.max(0, getTotalCartAmount() - calculateDiscount());
    const taxAmt = computeTax(data.state, effectiveSubtotal);
    const finalAmount = getTotalCartAmount() === 0 ? 0 : getTotalCartAmount() + 50 - calculateDiscount() + taxAmt;

    let orderData = {
      address: {
        ...data,
        email: data.email || userEmail || localStorage.getItem("userEmail") || "",
      },
      items: orderItems,
      amount: finalAmount,
      promoCode: appliedCheckoutPromo || promoData.code || null,
      orderedForSomeoneElse,
      paymentMethod,
    };

    if (saveAddress && !data.id && !selectedAddressId) {
      await axios.post(url + "/api/user/address", { address: data }, { headers: { token } });
    }

    try {
      let response = await axios.post(url + "/api/order/place", orderData, { headers: { token } });
      if (response.data.success) {
        if (paymentMethod === "COD") {
          setCartItems({});
          toast.success(response.data.message || "Order placed successfully");
          navigate("/myorders");
        } else {
          const { session_url } = response.data;
          window.location.replace(session_url);
        }
      } else {
        toast.error(response.data.message || "Something went wrong!");
        setLoading(false);
      }
    } catch (err) {
      toast.error("Network Error: Could not place order");
      setLoading(false);
    }
  };

  const fetchSavedAddresses = async () => {
    try {
      const response = await axios.get(url + "/api/user/addresses", { headers: { token } });
      if (response.data.success) {
        setSavedAddresses(response.data.addresses);
      }
    } catch (error) {
      console.log("Failed to fetch addresses");
    }
  };

  useEffect(() => {
    if (token) {
      fetchSavedAddresses();
    }
    const currentToken = token || localStorage.getItem("token");
    if (!currentToken) {
      toast.error("Please Login first");
      navigate("/cart");
    } else if (getTotalCartAmount() === 0) {
      toast.error("Please Add Items to Cart");
      navigate("/cart");
    }
  }, [token, getTotalCartAmount, navigate]);

  const rawTotal = getTotalCartAmount() === 0 ? 0 : getTotalCartAmount() + 50 - calculateDiscount() + computeTax(data.state, getTotalCartAmount() - calculateDiscount());
  const animatedTotal = useCountUp(rawTotal);

  return (
    <div className="place-order-wrapper" style={{ marginTop: '50px' }}>
      
      {/* Horizontal Progress Stepper */}
      <div className="flex items-center justify-center mb-10 w-full max-w-2xl mx-auto">
        <div className="flex items-center text-gray-500">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold">✓</div>
            <span className="text-sm mt-2">Cart</span>
          </div>
          <div className="w-16 sm:w-24 border-t-2 border-gray-200 dark:border-gray-700 mx-2"></div>
          <div className="flex flex-col items-center">
            <div
              className="relative w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-[0_0_15px_rgba(0,0,0,0.18)]"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span
                className="absolute w-full h-full rounded-full border-2 animate-ping opacity-75"
                style={{ borderColor: "var(--primary)" }}
              />
              2
            </div>
            <span className="text-sm mt-2 font-semibold" style={{ color: "var(--primary)" }}>Delivery</span>
          </div>
          <div className="w-16 sm:w-24 border-t-2 border-gray-200 dark:border-gray-700 mx-2"></div>
          <div className="flex flex-col items-center opacity-50">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold">3</div>
            <span className="text-sm mt-2">Payment</span>
          </div>
        </div>
      </div>

      <form className="place-order" onSubmit={placeOrder} noValidate>
        <div className="place-order-left">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <p className="title" style={{ margin: 0 }}>Delivery Information</p>
             {!selectedAddressId && (
               <button 
                type="button"
                onClick={handleGeolocation}
                className="current-location-btn flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors"
                disabled={fetchingLocation}
               >
                 {fetchingLocation ? (
                   <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                 ) : (
                   <span>🎯</span>
                 )}
                 {fetchingLocation ? "Locating..." : "Use Current Location"}
               </button>
             )}
          </div>

          {savedAddresses.length > 0 && !selectedAddressId && (
            <div className="saved-addresses" style={{ marginBottom: "15px" }}>
              <select
                className="address-select"
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedAddressId(e.target.value);
                    const selected = savedAddresses.find(a => a.id === e.target.value);
                    if (selected) setData(selected);
                  }
                }}>
                <option value="">Select a saved address...</option>
                {savedAddresses.map(addr => (
                  <option key={addr.id} value={addr.id}>
                    {addr.street}, {addr.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedAddressId ? (
            <div className="bg-[#f8fafc] dark:bg-[#1e293b] p-5 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 shadow-sm transition-all animate-[fadeIn_0.3s_ease-out]">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <span>📍</span> Selected Address
                </h4>
                <button 
                  type="button" 
                  onClick={() => setSelectedAddressId("")}
                  className="text-sm hover:underline cursor-pointer"
                  style={{ color: "var(--primary)" }}
                >
                  Edit / Change
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-3">
                {data.firstName} {data.lastName}
                <br/>
                {data.street}
                <br/>
                {data.city}, {data.state} {data.zipcode}
                <br/>
                {data.country}
              </p>
            </div>
          ) : (
            <div className="transition-all animate-[fadeIn_0.3s_ease-out]">
              <div className="multi-fields">
                <input name="firstName" value={data.firstName} onChange={onChangeHandler} type="text" placeholder="First name" />
                <input name="lastName" value={data.lastName} onChange={onChangeHandler} type="text" placeholder="Last name" />
              </div>
              <div className="field-errors-row">
                <span className="field-error-text">{fieldErrors.firstName || ""}</span>
                <span className="field-error-text">{fieldErrors.lastName || ""}</span>
              </div>
              <input name="email" value={data.email} onChange={onChangeHandler} type="text" placeholder="Email Address" />
              <p className="field-error-text">{fieldErrors.email || ""}</p>

              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}
                onPlaceSelected={(place) => {
                  if (!place.address_components) return;
                  let street = "", city = "", state = "", zipcode = "", country = "";

                  place.address_components.forEach(component => {
                    const types = component.types;
                    if (types.includes("street_number")) street += component.long_name + " ";
                    if (types.includes("route")) street += component.long_name;
                    if (types.includes("locality")) city = component.long_name;
                    if (types.includes("administrative_area_level_1")) state = component.short_name;
                    if (types.includes("country")) country = component.long_name;
                    if (types.includes("postal_code")) zipcode = component.long_name;
                  });

                  setData(prev => ({
                    ...prev,
                    street: street || place.formatted_address || prev.street,
                    city: city || prev.city,
                    state: state || prev.state,
                    zipcode: zipcode || prev.zipcode,
                    country: country || prev.country
                  }));
                }}
                options={{ types: ["address"] }}
                value={data.street}
                placeholder="Search Address or Type Manually"
                className="google-places-input"
                onChange={onChangeHandler}
                name="street"
              />
              <p className="field-error-text">{fieldErrors.street || ""}</p>

              <div className="multi-fields">
                <input name="city" value={data.city} onChange={onChangeHandler} type="text" placeholder="City" />
                <input name="state" value={data.state} onChange={onChangeHandler} type="text" placeholder="State" />
              </div>
              <div className="field-errors-row">
                <span className="field-error-text">{fieldErrors.city || ""}</span>
                <span className="field-error-text">{fieldErrors.state || ""}</span>
              </div>
              <div className="multi-fields">
                <input name="zipcode" value={data.zipcode} onChange={onChangeHandler} type="text" placeholder="Zip Code" />
                <input name="country" value={data.country} onChange={onChangeHandler} type="text" placeholder="Country" />
              </div>
              <div className="field-errors-row">
                <span className="field-error-text">{fieldErrors.zipcode || ""}</span>
                <span className="field-error-text">{fieldErrors.country || ""}</span>
              </div>
              <input name="phone" value={data.phone} onChange={onChangeHandler} type="text" placeholder="Phone" />
              <p className="field-error-text">{fieldErrors.phone || ""}</p>

              <div className="save-address-checkbox">
                <label>
                  <input type="checkbox" checked={saveAddress} onChange={() => setSaveAddress(!saveAddress)} />
                  Save this address to my Address Book
                </label>
              </div>
            </div>
          )}

        </div>
        <div className="place-order-right">
          <div className="cart-total relative">
            <h2>Cart Totals</h2>
            <div>
              <div className="cart-total-details">
                <p>Subtotals</p>
                <p>₹{getTotalCartAmount()}</p>
              </div>
              <hr />
              
              {(promoData.code || appliedCheckoutPromo) && (
                <>
                  <div className="cart-total-details text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 p-2 rounded-lg my-1">
                    <p className="flex items-center gap-2"><span>🛍️</span> Promos Applied</p>
                    <p>-₹{Math.round(calculateDiscount())}</p>
                  </div>
                  <hr />
                </>
              )}
              
              <div className="cart-total-details">
                <p>Delivery Fee</p>
                <p>₹{getTotalCartAmount() === 0 ? 0 : 50}</p>
              </div>
              <hr />
              <div className="cart-total-details">
                <p>Estimated Tax</p>
                <p>₹{getTotalCartAmount() === 0 ? 0 : computeTax(data.state, getTotalCartAmount() - calculateDiscount())}</p>
              </div>
              <hr />
              <div className="cart-total-details text-lg mt-4">
                <b>Total</b>
                <b className="flex items-center gap-3">
                  {calculateDiscount() > 0 && (
                    <span className="text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-800/40 dark:text-green-300 px-2 py-1 rounded-full animate-pulse">
                      You saved ₹{Math.round(calculateDiscount())}!
                    </span>
                  )}
                  <span className="text-2xl" style={{ color: "var(--primary)" }}>₹{animatedTotal}</span>
                </b>
              </div>
            </div>

            {/* Dynamic Promo Field directly on checkout */}
            <div className="mt-6 mb-2 border border-gray-200 dark:border-gray-700 rounded-lg p-1 flex">
              <input 
                type="text" 
                placeholder="Promo Code (e.g. BITE20)" 
                value={checkoutPromo}
                onChange={(e) => setCheckoutPromo(e.target.value)}
                className="w-full bg-transparent outline-none px-3 text-sm text-gray-700 dark:text-gray-200"
                disabled={appliedCheckoutPromo !== ""}
              />
              <button 
                type="button" 
                onClick={appliedCheckoutPromo ? () => setAppliedCheckoutPromo("") : applyCheckoutPromo}
                className={`promo-btn px-4 py-2 text-sm font-semibold rounded-md transition-colors ${appliedCheckoutPromo ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'}`}
              >
                {appliedCheckoutPromo ? "Remove" : "Apply"}
              </button>
            </div>

            <div className="payment-method-selector pt-4">
              <h2 className="text-lg">Payment Method</h2>
              <div className="payment-options">
                <label className="transition-colors">
                  <input type="radio" name="paymentMethod" value="Stripe" checked={paymentMethod === "Stripe"} onChange={(e) => setPaymentMethod(e.target.value)} />
                  Credit/Debit (Stripe)
                </label>
                <label className="transition-colors">
                  <input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === "COD"} onChange={(e) => setPaymentMethod(e.target.value)} />
                  Cash on Delivery
                </label>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full mt-6 py-3 px-4 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 cursor-not-allowed scale-[0.98]' : 'active:scale-[0.98] hover:-translate-y-0.5'}`}
              style={{
                background: loading ? undefined : "var(--gradient-primary)",
                boxShadow: loading ? undefined : "0 14px 40px color-mix(in srgb, var(--primary) 28%, transparent)",
              }}
            >
              {loading && <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></span>}
              {loading ? "PROCESSING..." : (paymentMethod === "COD" ? "PLACE ORDER (COD)" : "PROCEED TO PAYMENT")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PlaceOrder;
