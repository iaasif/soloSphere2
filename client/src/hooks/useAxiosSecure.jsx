// import React from 'react';
import { axios } from "axios";
import { createContext } from "react";

const axiosSecure = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});


const useAxiosSecure = () => {
  return axiosSecure;
};

export default useAxiosSecure;
