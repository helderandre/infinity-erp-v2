import {
  Briefcase, Truck, Scale, Stamp, Landmark, Camera, HardHat, Shield, Zap,
  Sparkles, ClipboardCheck, Ruler, Sofa, BadgePercent, Palette, Megaphone,
  Building2, Hammer, Wrench, Gavel, Package, Store, Cog, Calculator, PenTool,
  Compass, Home, CreditCard, Receipt, FileText, HelpCircle, MoreHorizontal,
  Users, UserCheck, UserCog, Paintbrush, Lightbulb, Bolt, Phone, Mail,
  TreePine, Wind, Leaf, Droplet, Recycle, Car, Bike, Bus, Plane, Ship, Anchor,
  ShoppingBag, Gift, Tag, Star, Heart, Music, Film, Tv, Globe, Map, Flag,
  Clock, Calendar, Award, Target, Rocket, Trophy, Crown,
} from 'lucide-react'

export const PARTNER_CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Briefcase, Truck, Scale, Stamp, Landmark, Camera, HardHat, Shield, Zap,
  Sparkles, ClipboardCheck, Ruler, Sofa, BadgePercent, Palette, Megaphone,
  Building2, Hammer, Wrench, Gavel, Package, Store, Cog, Calculator, PenTool,
  Compass, Home, CreditCard, Receipt, FileText, HelpCircle, MoreHorizontal,
  Users, UserCheck, UserCog, Paintbrush, Lightbulb, Bolt, Phone, Mail,
  TreePine, Wind, Leaf, Droplet, Recycle, Car, Bike, Bus, Plane, Ship, Anchor,
  ShoppingBag, Gift, Tag, Star, Heart, Music, Film, Tv, Globe, Map, Flag,
  Clock, Calendar, Award, Target, Rocket, Trophy, Crown,
}

export const PARTNER_CATEGORY_ICON_OPTIONS = Object.keys(PARTNER_CATEGORY_ICON_MAP)

export function resolvePartnerCategoryIcon(name: string): React.ElementType {
  return PARTNER_CATEGORY_ICON_MAP[name] || Briefcase
}
