import Inventory from './pages/Inventory';
import AddWatch from './pages/AddWatch';
import WatchDetail from './pages/WatchDetail';
import Sources from './pages/Sources';
import Auctions from './pages/Auctions';
import SoldInventory from './pages/SoldInventory';
import ImportSources from './pages/ImportSources';
import OptimizeImages from './pages/OptimizeImages';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Inventory": Inventory,
    "AddWatch": AddWatch,
    "WatchDetail": WatchDetail,
    "Sources": Sources,
    "Auctions": Auctions,
    "SoldInventory": SoldInventory,
    "ImportSources": ImportSources,
    "OptimizeImages": OptimizeImages,
}

export const pagesConfig = {
    mainPage: "Inventory",
    Pages: PAGES,
    Layout: __Layout,
};