import React, { useContext, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/frontend_assets/assets';
import './ResetPassword.css';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { url } = useContext(StoreContext);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const submitHandler = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        try {
            const response = await axios.post(`${url}/api/user/reset-password`, {
                token,
                password,
            });

            if (response.data.success) {
                toast.success(response.data.message);
                navigate('/');
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        }
    };

    return (
        <div className='reset-password'>
            <form onSubmit={submitHandler} className='reset-password-container'>
                <div className='reset-password-title'>
                    <h2>Set New Password</h2>
                    <img
                        src={assets.cross_icon}
                        alt='Close'
                        onClick={() => navigate('/')}
                    />
                </div>
                <div className='reset-password-inputs'>
                    <input
                        type='password'
                        placeholder='New password'
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                    />
                    <input
                        type='password'
                        placeholder='Confirm new password'
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={8}
                    />
                </div>
                <button type='submit'>Reset Password</button>
            </form>
        </div>
    );
};

export default ResetPassword;
