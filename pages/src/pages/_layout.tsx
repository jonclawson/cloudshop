// import { Outlet, Link } from 'react-router-dom';
// import React, { useEffect, useState } from 'react';
// import { useAuth } from '../AuthContext';
// import { productsApi } from '../useApi';
// export default function GlobalLayout() {
//   const { isAuthenticated } = useAuth();
//     const [products, setProducts] = useState([]);
//     const [loading, setLoading] = useState(true);
  
//     useEffect(() => {
//       const fetchProducts = async () => {
//         try {
//           const response = await productsApi.getAll();
//           setProducts(response.data.products || []);
//         } catch (error) {
//           console.error('Failed to fetch products:', error);
//         } finally {
//           setLoading(false);
//         }
//       };
  
//       fetchProducts();
//     }, []);

//   return (
//     <div className="min-h-screen bg-white">
      
//      {/* Header */}
//       <header className="bg-white shadow">
//         <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
//           <div className="flex justify-between items-center">
//             <h1 className="text-3xl font-bold text-gray-900">Cloudshop</h1>
//             <nav className="flex space-x-4">
//               {isAuthenticated ? (
//                 <>
//                   <a href="/orders" className="text-gray-700 hover:text-gray-900">
//                     Orders
//                   </a>
//                   <a href="/cart" className="text-gray-700 hover:text-gray-900">
//                     Cart
//                   </a>
//                   <a href="/login" className="text-gray-700 hover:text-gray-900">
//                     Logout
//                   </a>
//                 </>
//               ) : (
//                 <a href="/login" className="text-gray-700 hover:text-gray-900">
//                   Login
//                 </a>
//               )}
//             </nav>
//           </div>
//         </div>
//       </header>

//       {/* --- ACTIVE CONTENT INJECTION --- */}
//        <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
//         <Outlet /> 
//       </main>

//       {/* --- SHARED FOOTER --- */}
//       <footer className="border-t border-slate-800 bg-slate-950 text-xs text-slate-500">
//         <div className="mx-auto max-w-7xl px-4 py-6 text-center">
//           &copy; {new Date().getFullYear()} My Store Inc. All rights reserved.
//         </div>
//       </footer>

//     </div>
//   );
// }