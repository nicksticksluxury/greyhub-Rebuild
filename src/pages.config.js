import Inventory from './pages/Inventory';
import AddWatch from './pages/AddWatch';
import WatchDetail from './pages/WatchDetail';
import Auctions from './pages/Auctions';
import SoldInventory from './pages/SoldInventory';
import UpdateMinimumPrices from './pages/UpdateMinimumPrices';
import WatchSummary from './pages/WatchSummary';
import Settings from './pages/Settings';
import WatchSources from './pages/WatchSources';
import WatchSourceDetail from './pages/WatchSourceDetail';
import SourceWatches from './pages/SourceWatches';
import SalesView from './pages/SalesView';
import index from './pages/index';
import OutForRepair from './pages/OutForRepair';
import CompanySettings from './pages/CompanySettings';
import AcceptInvitation from './pages/AcceptInvitation';
import SystemAdmin from './pages/SystemAdmin';
import SquareTest from './pages/SquareTest';
import JoinCompany from './pages/JoinCompany';
import TenantSettings from './pages/TenantSettings';
import CompleteSignup from './pages/CompleteSignup';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Inventory": Inventory,
    "AddWatch": AddWatch,
    "WatchDetail": WatchDetail,
    "Auctions": Auctions,
    "SoldInventory": SoldInventory,
    "UpdateMinimumPrices": UpdateMinimumPrices,
    "WatchSummary": WatchSummary,
    "Settings": Settings,
    "WatchSources": WatchSources,
    "WatchSourceDetail": WatchSourceDetail,
    "SourceWatches": SourceWatches,
    "SalesView": SalesView,
    "index": index,
    "OutForRepair": OutForRepair,
    "CompanySettings": CompanySettings,
    "AcceptInvitation": AcceptInvitation,
    "SystemAdmin": SystemAdmin,
    "SquareTest": SquareTest,
    "JoinCompany": JoinCompany,
    "TenantSettings": TenantSettings,
    "CompleteSignup": CompleteSignup,
}

export const pagesConfig = {
    mainPage: "index",
    Pages: PAGES,
    Layout: __Layout,
};