import AcceptInvitation from './pages/AcceptInvitation';
import AddWatch from './pages/AddWatch';
import Auctions from './pages/Auctions';
import CompanySettings from './pages/CompanySettings';
import CompleteSignup from './pages/CompleteSignup';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import JoinCompany from './pages/JoinCompany';
import OutForRepair from './pages/OutForRepair';
import SalesView from './pages/SalesView';
import Settings from './pages/Settings';
import SoldInventory from './pages/SoldInventory';
import SourceWatches from './pages/SourceWatches';
import SquareTest from './pages/SquareTest';
import Subscriptions from './pages/Subscriptions';
import SystemAdmin from './pages/SystemAdmin';
import TenantSettings from './pages/TenantSettings';
import UpdateMinimumPrices from './pages/UpdateMinimumPrices';
import WatchDetail from './pages/WatchDetail';
import WatchSourceDetail from './pages/WatchSourceDetail';
import WatchSources from './pages/WatchSources';
import WatchSummary from './pages/WatchSummary';
import index from './pages/index';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcceptInvitation": AcceptInvitation,
    "AddWatch": AddWatch,
    "Auctions": Auctions,
    "CompanySettings": CompanySettings,
    "CompleteSignup": CompleteSignup,
    "Home": Home,
    "Inventory": Inventory,
    "JoinCompany": JoinCompany,
    "OutForRepair": OutForRepair,
    "SalesView": SalesView,
    "Settings": Settings,
    "SoldInventory": SoldInventory,
    "SourceWatches": SourceWatches,
    "SquareTest": SquareTest,
    "Subscriptions": Subscriptions,
    "SystemAdmin": SystemAdmin,
    "TenantSettings": TenantSettings,
    "UpdateMinimumPrices": UpdateMinimumPrices,
    "WatchDetail": WatchDetail,
    "WatchSourceDetail": WatchSourceDetail,
    "WatchSources": WatchSources,
    "WatchSummary": WatchSummary,
    "index": index,
}

export const pagesConfig = {
    mainPage: "index",
    Pages: PAGES,
    Layout: __Layout,
};