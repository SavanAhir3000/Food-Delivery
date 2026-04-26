// import React, { useContext, useState } from "react";
// import "./Cart.css";
// import { StoreContext } from "../../context/StoreContext";
// import { useNavigate } from "react-router-dom";
// import { FaTimes } from "react-icons/fa";

// const Cart = () => {
//   const {
//     food_list,
//     cartItems,
//     removeFromCart,
//     getTotalCartAmount,
//   } = useContext(StoreContext);
// console.log(food_list,"food_list");

//   const [orderForSomeoneElse, setOrderForSomeoneElse] = useState(false);
//   const navigate = useNavigate();

//   const getTotalCalories = () => {
//     if (orderForSomeoneElse) return 0;

//     let totalCalories = 0;
//     food_list.forEach((item) => {
//       if (cartItems[item._id] > 0) {
//         totalCalories += item.calorie * cartItems[item._id];
//       }
//     });
//     console.log(totalCalories,"totalCalories");

//     return totalCalories;
//   };

//   return (
//     <div className="cart">
//       <div className="cart-items">
//         <div className="cart-items-title">
//           <p>Items</p>
//           <p>Title</p>
//           <p>Price</p>
//           <p>Calorie</p>
//           <p>Quantity</p>
//           <p>Total</p>
//           <p>Total Cal</p>
//           <p>Remove</p>
//         </div>
//         <br />
//         <hr />

//         {food_list && cartItems &&
//           food_list.map((item, index) => {
//             if (cartItems[item._id] > 0) {
//               return (
//                 <div key={item._id}>
//                   <div className="cart-items-title cart-items-item">
//                     <img src={`/src/assets/frontend_assets/food_${index + 1}.png`} alt="" />
//                     <p>{item.name}</p>
//                     <p>₹{item.price}</p>
//                     <p>{orderForSomeoneElse ? "-" : `${item.calorie} Cal`}</p>
//                     <p>{cartItems[item._id]}</p>
//                     <p>₹{item.price * cartItems[item._id]}</p>
//                     <p onClick={() => removeFromCart(item._id)} className="cross">
//                       <FaTimes color="#404040" />
//                     </p>
//                   </div>
//                   <hr />
//                 </div>
//               );
//             }
//             return null;
//           })}
//       </div>

//       <div className="cart-bottom">
//         <div className="cart-total">
//           <h2>Cart Totals</h2>
//           <div className="cart-total-details">
//             <p>Subtotals</p>
//             <p>₹{getTotalCartAmount()}</p>
//           </div>
//           <hr />
//           <div className="cart-total-details">
//             <p>Delivery Fee</p>
//             <p>₹{getTotalCartAmount() === 0 ? 0 : 50}</p>
//           </div>
//           <hr />
//           <div className="cart-total-details">
//             <b>Total</b>
//             <b>₹{getTotalCartAmount() === 0 ? 0 : getTotalCartAmount() + 50}</b>
//           </div>
//           <hr />
//           <div className="cart-total-details">
//             <b>Total Calories</b>
//             <b>{getTotalCalories()} Cal</b>
//           </div>
//           {/* <button onClick={() => navigate('/order')}>PROCEED TO CHECKOUT</button> */}
//           <button onClick={() => navigate('/order', { state: { orderForSomeoneElse } })}>PROCEED TO CHECKOUT</button>
//         </div>

//         <div className="cart-promocode">
//           <div>
//             <div className="order-for-others">
//               <label>
//                 <input
//                   type="checkbox"
//                   checked={orderForSomeoneElse}
//                   onChange={() => setOrderForSomeoneElse(!orderForSomeoneElse)}
//                 />
//                 Ordering for someone else (calories won’t be counted)
//               </label>
//             </div>

//             <p>If you have a promocode, Enter it here</p>
//             <div className="cart-promocode-input">
//               <input type="text" placeholder="promo code" />
//               <button>Submit</button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Cart;





import React, { useContext, useMemo, useState, useEffect } from "react";
import "./Cart.css";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import { FaTimes } from "react-icons/fa";
import axios from "axios";
import { toast } from "react-toastify";
import { computeTax } from "../../utils/taxUtils";

const Cart = () => {
  const {
    food_list,
    cartItems,
    removeFromCart,
    getTotalCartAmount,
    url,
    token,
    promoData,
    setPromoData
  } = useContext(StoreContext);

  const [orderForSomeoneElse, setOrderForSomeoneElse] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const cartEntries = useMemo(
    () => (food_list || []).filter((item) => (cartItems?.[item._id] || 0) > 0),
    [food_list, cartItems]
  );
  const isCartEmpty = cartEntries.length === 0;



  const getTotalCalories = () => {
    if (orderForSomeoneElse) return 0;

    let totalCalories = 0;
    food_list.forEach((item) => {
      if (cartItems[item._id] > 0) {
        totalCalories += item.calorie * cartItems[item._id];
      }
      console.log(totalCalories, "totalCalories..");

    });
    return totalCalories;
  };

  return (
    <div className="cart">
      <div className="cart-items">
        <div className="cart-items-title">
          <p>Items</p>
          <p>Title</p>
          <p>Price</p>
          <p>Calorie</p>
          <p>Quantity</p>
          <p>Total</p>
          <p>Total Cal</p>
          <p>Remove</p>
        </div>
        <br />
        <hr />

        {cartEntries.map((item) => (
          <div key={item._id}>
            <div className="cart-items-title cart-items-item">
              <img src={item.image} alt={item.name} />
              <p>{item.name}</p>
              <p>₹{item.price}</p>
              <p>{orderForSomeoneElse ? "-" : `${item.calorie} Cal`}</p>
              <p>{cartItems[item._id]}</p>
              <p>₹{item.price * cartItems[item._id]}</p>
              <p>{orderForSomeoneElse ? "-" : `${item.calorie * cartItems[item._id]} Cal`}</p>
              <p onClick={() => removeFromCart(item._id)} className="cross">
                <FaTimes color="#404040" />
              </p>
            </div>
            <hr />
          </div>
        ))}

        {isCartEmpty && (
          <div className="cart-empty">
            <p className="cart-empty-title">Your cart is empty</p>
            <p className="cart-empty-subtitle">Add something tasty from the menu to continue.</p>
            <button
              onClick={() => {
                navigate("/");
                setTimeout(() => {
                  const el = document.getElementById("explore-menu");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 120);
              }}
              className="cart-empty-btn"
            >
              Explore Menu
            </button>
          </div>
        )}
      </div>

      <div className="cart-bottom">
        <div className="cart-total">
          <h2>Cart Totals</h2>
          <div className="cart-total-details">
            <p>Subtotals</p>
            <p>₹{getTotalCartAmount()}</p>
          </div>
          <hr />

          <div className="cart-total-details">
            <p>Delivery Fee</p>
            <p>₹{getTotalCartAmount() === 0 ? 0 : 50}</p>
          </div>
          <hr />
          <div className="cart-total-details">
            <p>Estimated Tax</p>
            <p>₹{getTotalCartAmount() === 0 ? 0 : computeTax("", getTotalCartAmount())}</p>
          </div>
          <hr />
          <div className="cart-total-details">
            <b>Total</b>
            <b>₹{getTotalCartAmount() === 0 ? 0 : getTotalCartAmount() + 50 + computeTax("", getTotalCartAmount())}</b>
          </div>
          <hr />
          <div className="cart-total-details">
            <b>Total Calories</b>
            <b>{getTotalCalories()} Cal</b>
          </div>
          <button
            onClick={() => navigate('/order', { state: { orderForSomeoneElse } })}
            disabled={isCartEmpty}
          >
            PROCEED TO CHECKOUT
          </button>
        </div>

        <div className="cart-promocode">
          <div style={{ width: '100%', marginTop: '20px' }}>
            <div className="order-for-others" style={{ width: '100%' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={orderForSomeoneElse}
                  onChange={() => setOrderForSomeoneElse(!orderForSomeoneElse)}
                  style={{ marginRight: '10px' }}
                />
                Ordering for someone else (calories won’t be counted)
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
