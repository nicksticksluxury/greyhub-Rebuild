import AcceptInvitation from './pages/AcceptInvitation';
import AddProduct from './pages/AddProduct';
import AiManagement from './pages/AiManagement';
import Auctions from './pages/Auctions';
import CompanySettings from './pages/CompanySettings';
import CompleteSignup from './pages/CompleteSignup';
import Dashboard from './pages/Dashboard';
import EbayFooterSettings from './pages/EbayFooterSettings';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import JoinCompany from './pages/JoinCompany';
import MergeData from './pages/MergeData';
import MigrateData from './pages/MigrateData';
import OutForRepair from './pages/OutForRepair';
import ProductDetail from './pages/ProductDetail';
import ProductTypeManagement from './pages/ProductTypeManagement';
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
import Logs from './pages/Logs';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcceptInvitation": AcceptInvitation,
    "AddProduct": AddProduct,
    "AiManagement": AiManagement,
    "Auctions": Auctions,
    "CompanySettings": CompanySettings,
    "CompleteSignup": CompleteSignup,
    "Dashboard": Dashboard,
    "EbayFooterSettings": EbayFooterSettings,
    "Home": Home,
    "Inventory": Inventory,
    "JoinCompany": JoinCompany,
    "MergeData": MergeData,
    "MigrateData": MigrateData,
    "OutForRepair": OutForRepair,
    "ProductDetail": ProductDetail,
    "ProductTypeManagement": ProductTypeManagement,
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
    "Logs": Logs,
}

export const pagesConfig = {
    mainPage: "index",
    Pages: PAGES,
    Layout: __Layout,
};