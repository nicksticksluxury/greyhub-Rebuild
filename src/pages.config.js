import Inventory from './pages/Inventory';
import AddWatch from './pages/AddWatch';
import WatchDetail from './pages/WatchDetail';
import Sources from './pages/Sources';
import Auctions from './pages/Auctions';
import SoldInventory from './pages/SoldInventory';
import ImportSources from './pages/ImportSources';
import UpdateMinimumPrices from './pages/UpdateMinimumPrices';
import ReoptimizeImages from './pages/ReoptimizeImages';
import WatchSummary from './pages/WatchSummary';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Inventory": Inventory,
    "AddWatch": AddWatch,
    "WatchDetail": WatchDetail,
    "Sources": Sources,
    "Auctions": Auctions,
    "SoldInventory": SoldInventory,
    "ImportSources": ImportSources,
    "UpdateMinimumPrices": UpdateMinimumPrices,
    "ReoptimizeImages": ReoptimizeImages,
    "WatchSummary": WatchSummary,
}

export const pagesConfig = {
    mainPage: "Inventory",
    Pages: PAGES,
    Layout: __Layout,
};