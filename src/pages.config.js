import AcceptInvitation from './pages/AcceptInvitation';
import Auctions from './pages/Auctions';
import CompanySettings from './pages/CompanySettings';
import CompleteSignup from './pages/CompleteSignup';
import Home from './pages/Home';
import JoinCompany from './pages/JoinCompany';
import MergeData from './pages/MergeData';
import MigrateData from './pages/MigrateData';
import OutForRepair from './pages/OutForRepair';
import ResolveProductDuplicates from './pages/ResolveProductDuplicates';
import RestoreData from './pages/RestoreData';
import SalesView from './pages/SalesView';
import Settings from './pages/Settings';
import SoldInventory from './pages/SoldInventory';
import SourceWatches from './pages/SourceWatches';
import SquareTest from './pages/SquareTest';
import Subscriptions from './pages/Subscriptions';
import SystemAdmin from './pages/SystemAdmin';
import TenantSettings from './pages/TenantSettings';
import UpdateMinimumPrices from './pages/UpdateMinimumPrices';
import WatchSourceDetail from './pages/WatchSourceDetail';
import WatchSources from './pages/WatchSources';
import WatchSummary from './pages/WatchSummary';
import index from './pages/index';
import ProductTypeManagement from './pages/ProductTypeManagement';
import AddProduct from './pages/AddProduct';
import Inventory from './pages/Inventory';
import ProductDetail from './pages/ProductDetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcceptInvitation": AcceptInvitation,
    "Auctions": Auctions,
    "CompanySettings": CompanySettings,
    "CompleteSignup": CompleteSignup,
    "Home": Home,
    "JoinCompany": JoinCompany,
    "MergeData": MergeData,
    "MigrateData": MigrateData,
    "OutForRepair": OutForRepair,
    "ResolveProductDuplicates": ResolveProductDuplicates,
    "RestoreData": RestoreData,
    "SalesView": SalesView,
    "Settings": Settings,
    "SoldInventory": SoldInventory,
    "SourceWatches": SourceWatches,
    "SquareTest": SquareTest,
    "Subscriptions": Subscriptions,
    "SystemAdmin": SystemAdmin,
    "TenantSettings": TenantSettings,
    "UpdateMinimumPrices": UpdateMinimumPrices,
    "WatchSourceDetail": WatchSourceDetail,
    "WatchSources": WatchSources,
    "WatchSummary": WatchSummary,
    "index": index,
    "ProductTypeManagement": ProductTypeManagement,
    "AddProduct": AddProduct,
    "Inventory": Inventory,
    "ProductDetail": ProductDetail,
}

export const pagesConfig = {
    mainPage: "index",
    Pages: PAGES,
    Layout: __Layout,
};