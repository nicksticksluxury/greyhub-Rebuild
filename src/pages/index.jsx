import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Watch, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const ContactEmail = () => {
    const [revealed, setRevealed] = React.useState(false);
    
    if (revealed) {
        return <a href="mailto:nkershner@outlook.com" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">nkershner@outlook.com</a>;
    }
    
    return (
        <button 
            onClick={() => setRevealed(true)}
            className="text-amber-400 hover:text-amber-300 font-semibold transition-colors underline decoration-dotted underline-offset-4"
        >
            Reveal Email Address
        </button>
    );
};

export default function Index() {
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        companyName: "",
        email: "",
        whatnotLink: ""
    });
    
    const [captcha, setCaptcha] = useState({ num1: 0, num2: 0 });
    const [captchaAnswer, setCaptchaAnswer] = useState("");
    
    React.useEffect(() => {
        if (showInviteForm) {
            const num1 = Math.floor(Math.random() * 10) + 1;
            const num2 = Math.floor(Math.random() * 10) + 1;
            setCaptcha({ num1, num2 });
            setCaptchaAnswer("");
        }
    }, [showInviteForm]);

    const handleSubmitInviteRequest = async (e) => {
        e.preventDefault();
        
        // Validate captcha
        if (parseInt(captchaAnswer) !== captcha.num1 + captcha.num2) {
            toast.error("Incorrect answer. Please try again.");
            return;
        }
        
        setSubmitting(true);
        
        try {
            await base44.integrations.Core.SendEmail({
                to: "1@nicksluxury.com",
                subject: "New Dealer Invite Request",
                body: `
New dealer invite request:

Full Name: ${formData.fullName}
Company Name: ${formData.companyName || "N/A"}
Email: ${formData.email}
Whatnot Profile: ${formData.whatnotLink}
                `.trim()
            });
            
            toast.success("Request submitted! We'll be in touch soon.");
            setShowInviteForm(false);
            setFormData({ fullName: "", companyName: "", email: "", whatnotLink: "" });
            setCaptchaAnswer("");
        } catch (error) {
            toast.error("Failed to submit request. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-200">
            <div className="max-w-3xl w-full space-y-12 text-center">
                
                {/* Header / Logo */}
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl flex items-center justify-center shadow-2xl border border-white/10 mx-auto rotate-3 hover:rotate-0 transition-transform duration-500">
                        <Watch className="w-10 h-10 text-amber-400" />
                    </div>
                    
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-2">
                            Nick's Ticks <span className="text-amber-400">&</span> Luxury
                        </h1>
                        <p className="text-xl md:text-2xl font-medium text-amber-500/90 uppercase tracking-widest">
                            The Store is Coming Soon!
                        </p>
                    </div>
                </div>

                {/* Main Copy */}
                <div className="space-y-6 text-lg leading-relaxed text-slate-400 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
                    <p className="text-xl text-slate-300 font-serif italic">
                        "Luxury meets chaos — and it's almost ready for you."
                    </p>
                    <p>
                        We're building something truly special for watch lovers, collectors, and dealers alike: a full online store powered by the same system that runs our private inventory and dealer tools.
                    </p>
                    <p>
                        This isn't just another watch site. It's the front door to a curated world of vintage, modern, and hard-to-find timepieces — handpicked, verified, and sold by the same madness that built Nick's Ticks & Luxury.
                    </p>
                </div>

                {/* Sections Grid */}
                <div className="grid md:grid-cols-2 gap-6 text-left animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                    {/* Private / Backend */}
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                            <Lock className="w-5 h-5 text-amber-400" />
                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Dealer Login</h3>
                        </div>
                        <p className="text-slate-400 mb-6">
                            Right now, most of our platform is private — it's where the real work happens: managing inventory, analyzing markets, and connecting with other watch dealers.
                            But the storefront is almost ready to open its doors.
                        </p>
                        <Link to={createPageUrl("Inventory")}>
                            <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                                Dealer Login <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>

                    {/* Dealers */}
                    <div className="p-8 rounded-2xl bg-gradient-to-br from-amber-950/30 to-transparent border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                         <div className="flex items-center gap-3 mb-4">
                            <Watch className="w-5 h-5 text-amber-400" />
                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">For Dealers & Retailers</h3>
                        </div>
                        <p className="text-slate-400 mb-6">
                            Request an invite and trial to our customized watch inventory, management and listing system!
                        </p>
                        <div className="space-y-3 text-sm text-slate-400 bg-slate-950/50 p-4 rounded-lg border border-amber-500/20 mb-6">
                            <p className="font-semibold text-amber-400">
                                If you're in a live show right now, and are looking for free entry into the game, please "Request Invite" below. Once you have filled that out, please put the following emoji in chat: 🧘🏼‍♂️
                            </p>
                            <p>
                                Wait for the host to recognize your emoji. If you haven't been recognized in a couple minutes, feel free to drop the emoji again. He will say Entry Received once he verifies you filled out the form.
                            </p>
                            <p className="text-amber-400/80 font-medium">
                                Anything that reveals or hints at revealing the entry method to others in chat will disqualify you from the giveaway.
                            </p>
                        </div>
                        <Button 
                            onClick={() => setShowInviteForm(true)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                        >
                            Request Invite <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <a 
                            href="https://youtu.be/qNMdD786wwo" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block mt-4 rounded-lg overflow-hidden border border-amber-500/30 hover:border-amber-500/60 transition-colors"
                        >
                            <iframe 
                                className="w-full aspect-video pointer-events-none"
                                src="https://www.youtube.com/embed/qNMdD786wwo"
                                title="Watch Demo"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </a>
                        </div>
                </div>

                {/* Footer */}
                <div className="pt-12 text-sm text-slate-600 animate-in fade-in duration-1000 delay-500">
                    &copy; {new Date().getFullYear()} Nick's Ticks & Luxury. All rights reserved.
                </div>
            </div>

            {/* Invite Request Dialog */}
            <Dialog open={showInviteForm} onOpenChange={setShowInviteForm}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-white">Request Dealer Invite</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Fill out the form below and we'll get back to you soon!
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitInviteRequest} className="space-y-4">
                        <div>
                            <Label htmlFor="fullName" className="text-slate-300">Full Name *</Label>
                            <Input
                                id="fullName"
                                value={formData.fullName}
                                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                required
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <div>
                            <Label htmlFor="companyName" className="text-slate-300">Company Name (if you have one)</Label>
                            <Input
                                id="companyName"
                                value={formData.companyName}
                                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <div>
                            <Label htmlFor="email" className="text-slate-300">Email Address *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                required
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <div>
                            <Label htmlFor="whatnotLink" className="text-slate-300">Whatnot Profile Link *</Label>
                            <Input
                                id="whatnotLink"
                                type="url"
                                value={formData.whatnotLink}
                                onChange={(e) => setFormData({...formData, whatnotLink: e.target.value})}
                                required
                                placeholder="https://www.whatnot.com/user/..."
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Go to your profile, click share, then Copy Link and paste that here
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="captcha" className="text-slate-300">Security Check *</Label>
                            <div className="flex items-center gap-3">
                                <p className="text-white font-mono text-lg">
                                    {captcha.num1} + {captcha.num2} =
                                </p>
                                <Input
                                    id="captcha"
                                    type="number"
                                    value={captchaAnswer}
                                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                                    required
                                    className="bg-slate-800 border-slate-700 text-white w-24"
                                    placeholder="?"
                                />
                            </div>
                        </div>
                        <Button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                        >
                            {submitting ? "Submitting..." : "Submit Request"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}